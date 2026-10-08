const http = require('http');
const { sendJson, readJson } = require('./respond');
const notes = require('./notes');

const routes = {
  'GET /health': (req, res) => sendJson(res, 200, { status: 'ok' }),
  'GET /notes': notes.list,
  'POST /notes': notes.create,
};

function createApp() {
  return http.createServer((req, res) => {
    const q = req.url.indexOf('?');
    const pathname = q === -1 ? req.url : req.url.slice(0, q);
    const handler = routes[`${req.method} ${pathname}`];
    if (!handler) return sendJson(res, 404, { error: 'not found' });
    return handler(req, res, readJson);
  });
}

module.exports = { createApp };
