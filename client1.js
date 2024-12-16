const http = require("http");

// Make a request to Node 1
const options = {
  hostname: "localhost",
  port: 3000,
  method: "GET",
  headers: {
    "Content-Type": "text/plain",
  },
};

const req = http.request(options, (res) => {
  let data = "";

  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    console.log("Client 1 received response:", data);
  });
});

req.on("error", (error) => {
  console.error(error);
});

req.end();
