/**
 * ShuttlePro Backend API scaffold (Node.js built-in http)
 *
 * Run: node backend/server.js
 * Endpoints:
 * - GET /api/health
 * - GET /api/bootstrap
 * - POST /api/sync
 */
const http = require('http');

const PORT = process.env.PORT || 8787;

let db = {
  passengers: [
    { id: 'P-1001', name: 'Nora James', plan: 'Weekly' },
    { id: 'P-1002', name: 'Leo Carter', plan: 'Daily' }
  ],
  plans: [
    { id: 'PL-1', name: 'Daily', price: 8 },
    { id: 'PL-2', name: 'Weekly', price: 32 },
    { id: 'PL-3', name: 'Custom', price: 55 }
  ],
  trips: [
    { id: 'T-1', shuttle: 'bessie perl', date: '2026-02-22', pickup: '69 duelk ave', dropoff: '72 main street', status: 'Scheduled' }
  ],
  sales: [{ id: 'S-1', amount: 32, type: 'Subscription', rider: 'Nora James' }]
};

function json(res, code, payload) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(payload));
}

function collectBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/api/health') {
    json(res, 200, { ok: true, service: 'shuttlepro-backend-scaffold' });
    return;
  }

  if (req.method === 'GET' && req.url === '/api/bootstrap') {
    json(res, 200, db);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/sync') {
    const payload = await collectBody(req);
    if (payload && payload.passengers && payload.trips && payload.plans && payload.sales) {
      db = payload;
      json(res, 200, { ok: true, message: 'State synchronized' });
      return;
    }
    json(res, 400, { ok: false, error: 'Invalid state payload' });
    return;
  }

  json(res, 404, { ok: false, error: 'Not found' });
}).listen(PORT, () => {
  console.log(`ShuttlePro API scaffold listening on http://localhost:${PORT}`);
});
