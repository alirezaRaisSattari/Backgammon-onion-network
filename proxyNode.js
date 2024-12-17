const http = require("http");
const httpProxy = require("http-proxy");
const crypto = require("crypto");

const ENCRYPTION_KEY = crypto.randomBytes(32); // 256-bit key
const IV_LENGTH = 16; // AES block size

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
        iv = crypto.randomBytes(IV_LENGTH);
        req.headers["x-init-vector"] = iv.toString("hex");
      } else {
        const ivHeader = req.headers["x-init-vector"];
        if (!ivHeader) {
          throw new Error(`Missing x-init-vector header at Node ${nodeNumber}`);
        }
        iv = Buffer.from(ivHeader, "hex");
      }

      let processedStream = req;

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

      if (isLastNode) {
        const options = {
          hostname: "localhost",
          port: 8000,
          method: req.method,
          path: req.url,
          headers: req.headers,
        };

        const externalReq = http.request(options, (externalRes) => {
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
          });
        });

        externalReq.on("error", (error) => {
          console.error(`Node ${nodeNumber} error:`, error.message);
          res.statusCode = 500;
          res.end("Error contacting external server");
        });

        processedStream.pipe(externalReq);
      } else {
        const nextIv = crypto.randomBytes(IV_LENGTH);
        req.headers["x-init-vector"] = nextIv.toString("hex");

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

        proxy.on("proxyRes", (proxyRes) => {
          const responseIv = ivMap.get(req.headers["x-request-id"]);
          const decryptedStream = decryptStream(
            ENCRYPTION_KEY,
            responseIv,
            proxyRes
          );
          let bodyChunks = [];

          decryptedStream.on("data", (chunk) => bodyChunks.push(chunk));
          decryptedStream.on("end", () => {
            const body = Buffer.concat(bodyChunks).toString();
            console.log(`Node ${nodeNumber} decrypted response:`, body);

            if (isFirstNode) {
              // res.setHeader("Content-Type", "application/json");
              console.log(body);
              res.end(body); // This sends the exact body logged to the client
              console.log(body);
              console.log(
                `Node ${nodeNumber} sent decrypted response to client`
              );
              ivMap.delete(req.headers["x-request-id"]);
            } else {
              console.log("xxxxx", body);

              const previousIv = Buffer.from(
                req.headers["x-init-vector"],
                "hex"
              );
              const reEncryptedStream = encryptStream(
                ENCRYPTION_KEY,
                previousIv,
                decryptedStream
              );
              reEncryptedStream.pipe(res).on("finish", () => {
                console.log(`Node ${nodeNumber} sent encrypted response`);
              });
            }
          });

          decryptedStream.on("error", (error) => {
            console.error(
              `Node ${nodeNumber} decryption error:`,
              error.message
            );
            res.statusCode = 500;
            res.end("Error in decrypting response");
          });
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

function createProxyNodes(numNodes, startPort) {
  let currentPort = startPort;

  for (let i = 1; i <= numNodes; i++) {
    createProxyNode(i, currentPort);
    currentPort++;
  }
}

createProxyNodes(3, 3000);
