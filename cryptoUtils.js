const crypto = require("crypto");

const ENCRYPTION_KEY = crypto.randomBytes(32); // 256-bit key
const IV_LENGTH = 16; // AES block size

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
