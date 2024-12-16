const crypto = require("crypto");

// AES encryption settings
const algorithm = "aes-256-cbc";
const key = crypto.randomBytes(32); // Secret key for encryption (this should be shared across proxies)
const iv = crypto.randomBytes(16); // Initialization vector for encryption (this should also be shared across proxies)

// Encrypt data and return base64 encoded data
function encrypt(text) {
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");
  return encrypted;
}

// Decrypt data from base64
function decrypt(encrypted) {
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

module.exports = { encrypt, decrypt };
