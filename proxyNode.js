const net = require("net");
const { decryptLayer, keys } = require("./encryption");

const router = (port, key, nextPort = null) => {
  const server = net.createServer((socket) => {
    socket.on("data", (data) => {
      const decrypted = decryptLayer(data, key);
      console.log(`Router on port ${port} received:`, decrypted.toString());

      if (nextPort) {
        const nextSocket = new net.Socket();
        nextSocket.connect(nextPort, "localhost", () => {
          nextSocket.write(decrypted);
        });
      } else {
        console.log("Final message:", decrypted.toString());
      }
    });
  });

  server.listen(port, () => console.log(`Router running on port ${port}`));
};

// Start routers
router(3000, keys[0], 3001);
router(3001, keys[1], 3002);
router(3002, keys[2]);
