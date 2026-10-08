const { createApp } = require('../src/app');

async function withServer(fn) {
  const server = createApp();
  await new Promise((r) => server.listen(0, r));
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

module.exports = { withServer };
