import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());

// Mock Auth
app.post('/api/auth/login', (req, res) => {
  res.json({ token: 'mock-token-' + Date.now(), user: { id: '1', name: 'Demo User', email: req.body.email, role: 'engineer' } });
});

app.post('/api/auth/register', (req, res) => {
  res.json({ token: 'mock-token-' + Date.now(), user: { id: '1', name: req.body.name, email: req.body.email, role: req.body.role } });
});

app.get('/api/auth/me', (req, res) => {
  res.json({ id: '1', name: 'Demo User', email: 'user@example.com', role: 'engineer' });
});

app.post('/api/users/me', (req, res) => {
  res.json({ success: true });
});

app.get('/api/users/me', (req, res) => {
  res.json({ id: '1', name: 'Demo User', email: 'user@example.com', role: 'engineer' });
});

// Mock AI Endpoints
app.post('/api/ai/improve-prompt', (req, res) => {
  res.json({ improvedPrompt: "Optimized: " + req.body.prompt });
});

app.post('/api/ai/generate', (req, res) => {
  res.json({ 
    id: 'part-' + Date.now(),
    geomData: { type: 'box', width: 1, height: 1, depth: 1 },
    status: 'draft'
  });
});

app.post('/api/ai/analyze', (req, res) => {
  res.json({ analysis: "Structural integrity verified. Stress concentrations at mounting points within limits." });
});

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// WebSocket logic
wss.on('connection', (ws) => {
  console.log('Client connected');
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    // Broadcast to all other clients
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(msg));
      }
    });
  });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
