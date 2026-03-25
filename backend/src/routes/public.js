'use strict';

const fs   = require('fs');
const path = require('path');

/**
 * Public routes — static files, health, landing page.
 * No auth required.
 */

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
const LANDING_PATH = path.join(__dirname, '..', '..', 'landing', 'index.html');

const MIME_MAP = {
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.pdf':  'application/pdf',
  '.obj':  'model/obj',
  '.glb':  'model/gltf-binary',
  '.html': 'text/html',
};

async function handle(req, res, rawRes, url) {
  const { pathname } = url;
  const method = req.method;

  // GET /api/health
  if (pathname === '/api/health' && method === 'GET') {
    res.status(200).json({ status: 'ok', version: 'phase5', timestamp: new Date().toISOString() });
    return true;
  }

  // GET /  or  /landing  → serve landing/index.html
  if ((pathname === '/' || pathname === '/landing') && method === 'GET') {
    if (fs.existsSync(LANDING_PATH)) {
      rawRes.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...res._headers });
      fs.createReadStream(LANDING_PATH).pipe(rawRes);
    } else {
      res.status(200).json({ message: 'MechaGen API', version: 'phase5' });
    }
    return true;
  }

  // GET /uploads/*  → serve uploaded files statically
  if (pathname.startsWith('/uploads/') && method === 'GET') {
    const filePath = path.join(UPLOADS_DIR, pathname.replace('/uploads/', ''));
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found' });
      return true;
    }
    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME_MAP[ext] || 'application/octet-stream';
    rawRes.writeHead(200, { ...res._headers, 'Content-Type': mime });
    fs.createReadStream(filePath).pipe(rawRes);
    return true;
  }

  return false;
}

module.exports = { handle };
