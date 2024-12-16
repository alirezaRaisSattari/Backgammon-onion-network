const net = require("net");
const crypto = require("crypto");
const http = require("http");

// Utility functions for AES
function generateAESKey() {
  return crypto.randomBytes(32); // 256-bit AES key
}

function aesEncrypt(data, key) {
  const iv = crypto.randomBytes(16); // Initialization vector
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return { encrypted, iv };
}

function aesDecrypt(encrypted, key, iv) {
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString();
}

// Utility functions for RSA
function rsaEncrypt(data, publicKey) {
  return crypto.publicEncrypt(publicKey, Buffer.from(data));
}

function rsaDecrypt(data, privateKey) {
  return crypto.privateDecrypt(privateKey, data).toString();
}

// Function to create a router node
function createRouter(
  port,
  privateKey,
  nextPort = null,
  mainServerPort = null
) {
  const server = net.createServer((socket) => {
    socket.on("data", (data) => {
      // Split the incoming message into RSA-encrypted AES key and encrypted payload
      const rsaEncryptedKey = data.slice(0, 256); // 2048-bit RSA key
      const aesEncryptedPayload = data.slice(256);

      // Decrypt AES key with RSA private key
      const aesKey = rsaDecrypt(rsaEncryptedKey, privateKey);

      // Extract IV and decrypt payload using AES
      const iv = aesEncryptedPayload.slice(0, 16); // First 16 bytes are IV
      const encryptedPayload = aesEncryptedPayload.slice(16);
      const decryptedPayload = aesDecrypt(encryptedPayload, aesKey, iv);

      console.log(`Router on port ${port} decrypted:`, decryptedPayload);

      if (nextPort) {
        // Forward to the next router
        const client = new net.Socket();
        client.connect(nextPort, "localhost", () => {
          client.write(Buffer.from(decryptedPayload));
        });
      } else if (mainServerPort) {
        // Proxy to the main HTTP server
        const [headers, body] = decryptedPayload.split("\n\n");
        const [method, url] = headers.split(" ");

        const options = {
          hostname: "localhost",
          port: mainServerPort,
          path: url,
          method,
          headers: parseHeaders(headers),
        };

        const proxyRequest = http.request(options, (response) => {
          let responseData = "";
          response.on("data", (chunk) => {
            responseData += chunk;
          });

          response.on("end", () => {
            socket.write(responseData);
          });
        });

        if (body) {
          proxyRequest.write(body);
        }
        proxyRequest.end();
      }
    });
  });

  server.listen(port, () => {
    console.log(`Router running on port ${port}`);
  });
}

// Utility function to parse HTTP headers
function parseHeaders(headerString) {
  const headers = {};
  const lines = headerString.split("\n");
  lines.forEach((line) => {
    const [key, value] = line.split(": ");
    if (key && value) {
      headers[key.trim()] = value.trim();
    }
  });
  return headers;
}

// Function to initialize the Onion Network
function setupOnionNetwork(routerCount, firstRouterPort, mainServerPort) {
  const routers = [];

  // Generate key pairs for each router
  for (let i = 0; i < routerCount; i++) {
    routers.push({
      port: firstRouterPort + i,
      ...crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }),
    });
  }

  // Create the routers
  for (let i = 0; i < routerCount; i++) {
    const nextPort = i < routerCount - 1 ? routers[i + 1].port : null;
    createRouter(
      routers[i].port,
      routers[i].privateKey,
      nextPort,
      mainServerPort
    );
  }

  return routers;
}

// Function for the client to send an HTTP request
function clientSendHttpRequest(request, routers) {
  // Generate a new AES key for this request
  const aesKey = generateAESKey();

  // Encrypt the HTTP request with AES
  const { encrypted, iv } = aesEncrypt(request, aesKey);

  // Encrypt the AES key with each router's public key in reverse order
  let encryptedKey = aesKey; // Start with the raw AES key
  for (let i = routers.length - 1; i >= 0; i--) {
    encryptedKey = rsaEncrypt(encryptedKey, routers[i].publicKey);
  }

  // Combine the RSA-encrypted AES key, IV, and AES-encrypted payload
  const message = Buffer.concat([encryptedKey, iv, encrypted]);

  // Send to the first router
  const client = new net.Socket();
  client.connect(routers[0].port, "localhost", () => {
    client.write(message);
    console.log("Client sent encrypted HTTP request to the first router");
  });

  client.on("error", (err) => {
    console.error("Client error:", err.message);
  });
}

module.exports = { setupOnionNetwork, clientSendHttpRequest };
