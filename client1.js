const net = require("net");

const { keys, encryptLayer } = require("./encryption");

const sendEncryptedMessage = () => {
  let message = Buffer.from("Hello, Onion Routing!");
  keys.reverse().forEach((key) => {
    message = encryptLayer(message, key);
  });

  const client = new net.Socket();
  client.connect(3000, "localhost", () => {
    console.log("Client sent:", message.toString("hex"));
    client.write(message);
  });
};

sendEncryptedMessage();
