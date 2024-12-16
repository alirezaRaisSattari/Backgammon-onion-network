const crypto = require("crypto");

const generateKey = () => crypto.randomBytes(32); // 256-bit key
const keys = [generateKey(), generateKey(), generateKey()];

const encryptLayer = (data, key) => {
  const cipher = crypto.createCipheriv("aes-256-cbc", key, Buffer.alloc(16, 0));
  return Buffer.concat([cipher.update(data), cipher.final()]);
};

const decryptLayer = (data, key) => {
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    key,
    Buffer.alloc(16, 0)
  );
  return Buffer.concat([decipher.update(data), decipher.final()]);
};

// Sample message
let message = Buffer.from("Hello, Onion Routing!");
keys.reverse().forEach((key) => {
  message = encryptLayer(message, key);
});

console.log("Encrypted Message:", message.toString("hex"));

module.exports = { decryptLayer, encryptLayer, keys };
