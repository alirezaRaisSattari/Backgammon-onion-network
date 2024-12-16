const http = require("http");
const httpProxy = require("http-proxy");
const crypto = require("crypto");

// Secret key for encryption (you could make this dynamic per node if needed)
const ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef"; // 32-byte key for AES-256
const ALGORITHM = "aes-256-cbc";

// Encrypt function
function encrypt(data, key) {
  const iv = crypto.randomBytes(16); // Initialization vector
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(data, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + encrypted; // Prepend IV to the encrypted data
}

// Decrypt function
function decrypt(data, key) {
  const iv = Buffer.from(data.slice(0, 32), "hex"); // Extract the first 16 bytes as the IV
  const encrypted = data.slice(32); // Extract the encrypted data
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// Function to create a specified number of proxy nodes
function createProxyNodes(numNodes, startPort) {
  let currentPort = startPort;

  // Loop to create each proxy node
  for (let i = 1; i <= numNodes; i++) {
    createProxyNode(i, currentPort);
    currentPort++;
  }
}

// Function to create a single proxy node
function createProxyNode(nodeNumber, port) {
  const proxy = httpProxy.createProxyServer({});

  // Define the target for the next node in the chain
  const nextPort = port + 1;

  // Create the HTTP server for each proxy node
  const server = http.createServer((req, res) => {
    let data = "";

    req.on("data", (chunk) => {
      data += chunk;
    });

    req.on("end", () => {
      try {
        // Decrypt the data at each node (except for the first node)
        if (nodeNumber !== 1) {
          data = decrypt(data, ENCRYPTION_KEY);
        }

        console.log(`Node ${nodeNumber} received data: ${data}`);

        // If it's the last node, forward to the target server
        if (nodeNumber === 3) {
          // Optionally, encrypt data before sending to the target
          const encryptedData = encrypt(data, ENCRYPTION_KEY);
          proxy.web(req, res, {
            target: "http://localhost:8000",
            selfHandleResponse: true,
          });
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(encryptedData);
        } else {
          // Encrypt data before forwarding it to the next node
          const encryptedData = encrypt(data, ENCRYPTION_KEY);
          proxy.web(req, res, { target: `http://localhost:${nextPort}` });
        }
      } catch (error) {
        console.error("Decryption error:", error);
        res.statusCode = 500;
        res.end("Error in processing the request");
      }
    });
  });

  server.listen(port, () => {
    console.log(
      `Proxy Node ${nodeNumber} is running on http://localhost:${port}`
    );
  });
}

// Create 3 proxy nodes starting from port 3000
createProxyNodes(3, 3000);
