import fetch from 'node-fetch';

async function testPipeline() {
  const payload = {
    text: "Severe flood in Kolkata, 200 families affected, urgent medical help needed"
  };

  console.log("Testing AidFlow Pipeline...");
  try {
    const response = await fetch('http://localhost:3000/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log("Pipeline Output:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Test failed:", error);
  }
}

testPipeline();
