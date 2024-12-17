const http = require("http");

const server = http.createServer((req, res) => {
  let bodyChunks = [];

  // Capture incoming data chunks
  req.on("data", (chunk) => {
    bodyChunks.push(chunk);
  });

  // Once all data is received
  req.on("end", () => {
    const body = Buffer.concat(bodyChunks).toString();
    console.log("Server on port 8000 received body:", body);

    // Respond to the client
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Request received and processed" }));
  });

  req.on("error", (error) => {
    console.error("Error receiving request:", error.message);
    res.statusCode = 500;
    res.end("Error processing request");
  });
});

// Start the server
server.listen(8000, () => {
  console.log("Server is running on http://localhost:8000");
});
