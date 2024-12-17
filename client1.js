(async () => {
  const fetch = (await import("node-fetch")).default;

  const url = "http://localhost:3000";
  const payload = { key: "value" }; // Example payload

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json(); // Use response.text() if the response isn't JSON
    console.log("Response Data:", data);
  } catch (error) {
    console.error("Error:", error.message);
  }
})();
