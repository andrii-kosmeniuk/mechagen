const http = require('http');

const body = JSON.stringify({ prompt: "A simple metric M8 bolt" });
const req = http.request({
  method: 'POST',
  hostname: 'localhost',
  port: 5173,
  path: '/api/generate',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': body.length
  }
}, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log("Status:", res.statusCode);
    if (res.statusCode !== 200) {
      console.log("Error body:", data);
    } else {
      const d = JSON.parse(data);
      console.log("Success! STL base64 length:", d.stl ? d.stl.length : "NO STL", "Code length:", d.code ? d.code.length : "NO CODE");
      console.log("Code preview:\n", d.code.substring(0, 100) + "...");
    }
  });
});

req.on('error', err => console.error("Request failed:", err));
req.write(body);
req.end();
