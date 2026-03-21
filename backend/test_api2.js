const http = require('http');

const body = JSON.stringify({ prompt: "A simple metric M8 bolt" });
const req = http.request({
  method: 'POST',
  hostname: '127.0.0.1', // explicit IP
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
      console.log("Success!");
    }
  });
});

req.on('error', err => console.error("Request failed:", err));
req.write(body);
req.end();
