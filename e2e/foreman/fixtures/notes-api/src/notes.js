const { sendJson } = require('./respond');

const store = [];
let nextId = 1;

function parseTerms(url) {
  const i = url.indexOf('?');
  if (i === -1) return [];
  const q = new URLSearchParams(url.slice(i + 1)).get('q');
  if (q === null) return [];
  return q.split('|').map((t) => t.trim().toLowerCase()).filter((t) => t);
}

function list(req, res) {
  sendJson(res, 200, store.slice().reverse());
}

async function create(req, res, readJson) {
  let body;
  try {
    body = await readJson(req);
  } catch {
    return sendJson(res, 400, { error: 'invalid JSON' });
  }
  if (typeof body.text !== 'string' || !body.text.trim()) {
    return sendJson(res, 400, { error: 'text is required' });
  }
  const note = { id: nextId++, text: body.text.trim() };
  store.push(note);
  return sendJson(res, 201, note);
}

function reset() {
  store.length = 0;
  nextId = 1;
}

module.exports = { list, create, reset, parseTerms };
