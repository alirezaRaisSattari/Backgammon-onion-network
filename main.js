const express = require("express");
const app = express();
const { setupOnionNetwork, clientSendHttpRequest } = require("./routers1.js");

const port = 8000;

app.get("/hello", (req, res) => {
  res.send("Hello, world!");
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

const routerCountClient1 = 3;
const firstRouterPort4Client1 = 3000;
const routerCountClient2 = 3;
const firstRouterPort4Client2 = 4000;
const main = 8000;

const client1routers = setupOnionNetwork(
  routerCountClient1,
  firstRouterPort4Client1,
  main
);

const client2routers = setupOnionNetwork(
  routerCountClient2,
  firstRouterPort4Client2,
  main
);

setTimeout(() => {
  const httpRequest = `GET / HTTP/1.1\nHost: localhost\n\n`;
  clientSendHttpRequest(httpRequest, client1routers);
}, 1000);

setTimeout(() => {
  const httpRequest = `GET / HTTP/1.1\nHost: localhost\n\n`;
  clientSendHttpRequest(httpRequest, client2routers);
}, 1000);
