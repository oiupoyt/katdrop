# katdrop

a minimal, smooth file transfer service with 10-minute auto-deletion.

↗ [katdrop.oiupoyt.space](https://katdrop.oiupoyt.space)

> **Backend API**: The official backend is powered by a permanent Cloudflare Tunnel at `https://katdrop-api.oiupoyt.space`.

## features

- minimal dark interface with smooth interactive particle background
- real-time backend status indicator (`online` / `offline`)
- live upload byte progress and percentage
- drag & drop files anywhere to upload instantly
- 10-minute auto-deletion timer per file with live countdown
- safe path verification and collision-free file naming
- anti-abuse IP rate limiting (120 req/min, 25 uploads/5min)
- storage quota guard (4GB cap protecting disk exhaustion)
- delete token authorization (only uploader can delete their file)
- anti-XSS download isolation (`Content-Security-Policy: default-src 'none'; sandbox` + force attachment)
- strict CORS domain whitelist (`*.oiupoyt.space`, `localhost`)

## configuration

The deployed frontend at `https://katdrop.oiupoyt.space` connects out of the box to the official permanent backend at `https://katdrop-api.oiupoyt.space`. No URL parameters or configuration required.

To connect to a custom private backend, pass `?api=...`:
```
https://katdrop.oiupoyt.space/?api=https://your-custom-backend.com
```

## usage

```bash
# install dependencies
npm install

# start server
npm start
```

Runs by default on `http://localhost:3000` (or falls back to an available port if 3000 is in use).

## endpoints

- `GET /health` - health check & uptime
- `POST /upload` - upload files (`file`)
- `GET /files` - list active files with remaining TTL
- `GET /uploads/:filename` - download file
- `DELETE /delete/:filename` - delete file

## license

MIT
