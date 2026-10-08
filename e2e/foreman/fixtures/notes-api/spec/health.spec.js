const test = require('node:test');
const assert = require('node:assert');
const { withServer } = require('./helpers');

test('GET /health returns ok', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/health`);
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), { status: 'ok' });
  });
});
