const http = require("http");

// Create the target server (final destination)
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Hello from the target server on port 8000!");
});

server.listen(8000, () => {
  console.log("Target server is running on http://localhost:8000");
});
