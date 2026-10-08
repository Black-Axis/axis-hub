const http = require('http');
const { sendJson, readJson } = require('./respond');
const notes = require('./notes');

// A Map, not an object: a request path like /constructor must not reach Object.prototype.
const routes = new Map([
  ['GET /health', (req, res) => sendJson(res, 200, { status: 'ok' })],
  ['GET /notes', notes.list],
  ['POST /notes', notes.create],
]);

function createApp() {
  return http.createServer((req, res) => {
    const q = req.url.indexOf('?');
    const pathname = q === -1 ? req.url : req.url.slice(0, q);
    const handler = routes.get(`${req.method} ${pathname}`);
    if (!handler) return sendJson(res, 404, { error: 'not found' });
    return handler(req, res, readJson);
  });
}

module.exports = { createApp };
