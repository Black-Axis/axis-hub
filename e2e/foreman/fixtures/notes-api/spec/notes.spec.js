const test = require('node:test');
const assert = require('node:assert');
const { withServer } = require('./helpers');
const notes = require('../src/notes');

test.beforeEach(() => notes.reset());

test('POST then GET /notes, newest first', async () => {
  await withServer(async (base) => {
    await fetch(`${base}/notes`, { method: 'POST', body: JSON.stringify({ text: 'first' }) });
    await fetch(`${base}/notes`, { method: 'POST', body: JSON.stringify({ text: 'second' }) });
    const list = await (await fetch(`${base}/notes`)).json();
    assert.deepStrictEqual(list.map((n) => n.text), ['second', 'first']);
  });
});

test('parseTerms splits on |, trims, lowercases, drops empty terms', () => {
  assert.deepStrictEqual(notes.parseTerms('/notes?q=Milk%20|%20mom|'), ['milk', 'mom']);
  assert.deepStrictEqual(notes.parseTerms('/notes'), []);
});
