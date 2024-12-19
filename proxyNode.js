const http = require("http");
const httpProxy = require("http-proxy");
const crypto = require("crypto");

const ENCRYPTION_KEY = crypto.randomBytes(32); // 256-bit key
const IV_LENGTH = 16; // AES block size

// Track IVs for each request-response cycle
const ivMap = new Map();

function encryptStream(key, iv, input) {
  const cipher = crypto.createCipheriv("aes-256-ctr", key, iv);
  return input.pipe(cipher);
}

function decryptStream(key, iv, input) {
  const decipher = crypto.createDecipheriv("aes-256-ctr", key, iv);
  return input.pipe(decipher);
}

function logBody(stream, callback) {
  let bodyChunks = [];
  stream.on("data", (chunk) => bodyChunks.push(chunk));
  stream.on("end", () => {
    const body = Buffer.concat(bodyChunks).toString();
    callback(body);
  });
}

function createProxyNode(nodeNumber, port) {
  const proxy = httpProxy.createProxyServer({});
  const nextPort = port + 1;

  const server = http.createServer((req, res) => {
    try {
      let iv;
      const isFirstNode = nodeNumber === 1;
      const isLastNode = nodeNumber === 3;

      if (isFirstNode) {
        // Generate a new IV for the request at the first node
        iv = crypto.randomBytes(IV_LENGTH);
        req.headers["x-init-vector"] = iv.toString("hex");
      } else {
        // Extract the IV from the header
        const ivHeader = req.headers["x-init-vector"];
        if (!ivHeader) {
          throw new Error(`Missing x-init-vector header at Node ${nodeNumber}`);
        }
        iv = Buffer.from(ivHeader, "hex");
      }

      let processedStream = req;

      // Decrypt incoming request body at intermediate and exit nodes
      if (!isFirstNode) {
        processedStream = decryptStream(ENCRYPTION_KEY, iv, req);
        logBody(processedStream, (body) =>
          console.log(`Node ${nodeNumber} decrypted body:`, body)
        );
      } else {
        logBody(processedStream, (body) =>
          console.log(`Node ${nodeNumber} received body:`, body)
        );
      }

      // Handle request at exit node or forward
      if (isLastNode) {
        const options = {
          hostname: "localhost",
          port: 8000,
          method: req.method,
          path: req.url,
          headers: req.headers,
        };

        const externalReq = http.request(options, (externalRes) => {
          // Encrypt the response from the server using the original request IV
          const responseIv = iv;
          res.setHeader("x-response-vector", responseIv.toString("hex"));

          logBody(externalRes, (body) =>
            console.log(`Node ${nodeNumber} server response:`, body)
          );

          const encryptedStream = encryptStream(
            ENCRYPTION_KEY,
            responseIv,
            externalRes
          );
          encryptedStream.pipe(res).on("finish", () => {
            console.log(`Node ${nodeNumber} sent encrypted response`);
            encryptedStream.end();
          });
        });

        externalReq.on("error", (error) => {
          console.error(`Node ${nodeNumber} error:`, error.message);
          res.statusCode = 500;
          res.end("Error contacting external server");
        });

        processedStream.pipe(externalReq).on("finish", () => {
          processedStream.end();
        });
      } else {
        // Encrypt request body and forward to the next node
        const nextIv = crypto.randomBytes(IV_LENGTH);
        req.headers["x-init-vector"] = nextIv.toString("hex");

        // Track IV for this request-response cycle
        const requestId = req.headers["x-request-id"] || crypto.randomUUID();
        req.headers["x-request-id"] = requestId;
        ivMap.set(requestId, nextIv);

        const encryptedStream = encryptStream(
          ENCRYPTION_KEY,
          nextIv,
          processedStream
        );

        proxy.web(req, res, {
          target: `http://localhost:${nextPort}`,
          buffer: encryptedStream,
        });
      }
    } catch (error) {
      console.error(`Node ${nodeNumber} error:`, error.message);
      res.statusCode = 500;
      res.end("Error in processing the request");
    }
  });

  server.listen(port, () => {
    console.log(
      `Proxy Node ${nodeNumber} is running on http://localhost:${port}`
    );
  });
}

// Function to create a specified number of proxy nodes
function createProxyNodes(numNodes, startPort) {
  let currentPort = startPort;

  for (let i = 1; i <= numNodes; i++) {
    createProxyNode(i, currentPort);
    currentPort++;
  }
}

// router for client1
createProxyNodes(3, 3000);
// router for client2
createProxyNodes(3, 4000);
