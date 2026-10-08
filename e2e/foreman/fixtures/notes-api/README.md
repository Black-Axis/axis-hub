# notes-api

Small in-memory notes HTTP API, used as the sample project of the foreman e2e scenarios.

- `GET /health` - `{ "status": "ok" }`
- `GET /notes` - all notes, newest first
- `POST /notes` - body `{ "text": "..." }`

Tests: `npm test`.
