const url = "http://localhost:3001/api/v1/ai/chat";

async function testFetch() {
  try {
    const payload = {
      message: "Calculate vitamin C for 30 yo pregnant smoker",
      threadId: "test-thread-001"
    };

    console.log(`Sending POST to ${url}`);
    console.log(`Payload:`, payload);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const status = response.status;
    console.log(`Status HTTP: ${status}`);

    const data = await response.json();
    console.log(`Response Data:\n`, JSON.stringify(data, null, 2));

  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

testFetch();
