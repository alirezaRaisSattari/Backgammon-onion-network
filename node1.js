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

function createProxyNode(port) {
  const proxy = httpProxy.createProxyServer({});
  const nextPort = port + 1;

  proxy.on("proxyRes", (proxyReq, req, res, options) => {
    // const previousIv = Buffer.from(req.headers["x-init-vector"], "hex");

    // const decryptedStream = decryptStream(
    //   ENCRYPTION_KEY,
    //   previousIv,
    //   proxyReq
    // );
    logBody(proxyReq, (body) => {
      console.log(`Node 1 decrypted response:`, body);
      // decryptedStream.end();
    });

    // decryptedStream.pipe(res).on("finish", () => {
    //   console.log(`Node ${nodeNumber} sent encrypted response`);
    //   // decryptedStream.end();
    // });
  });

  const server = http.createServer((req, res) => {
    try {
      let iv;

      // Generate a new IV for the request at the first node
      iv = crypto.randomBytes(IV_LENGTH);
      req.headers["x-init-vector"] = iv.toString("hex");

      let processedStream = req;

      // Decrypt incoming request body at intermediate and exit nodes

      logBody(processedStream, (body) =>
        console.log(`Node 1 received body:`, body)
      );

      // Handle request at exit node or forward

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
    } catch (error) {
      console.error(`Node 1 error:`, error.message);
      res.statusCode = 500;
      res.end("Error in processing the request");
    }
  });

  server.listen(port, () => {
    console.log(`Proxy Node 1 is running on http://localhost:${port}`);
  });
}
createProxyNode(3000);
