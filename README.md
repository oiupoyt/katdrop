# katdrop

a minimal, smooth file transfer service with 10-minute auto-deletion.

↗ [katdrop.oiupoyt.space](https://katdrop.oiupoyt.space)

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

If self-hosting the frontend separately from the backend, configure your API endpoint by setting `DEFAULT_REMOTE_API` in `public/js/app.js`:
```javascript
const DEFAULT_REMOTE_API = 'https://your-api-domain.com';
```

Or connect dynamically in the browser by passing `?api=...`:
```
https://your-katdrop-site.com/?api=https://your-api-domain.com
```
(Saved to `localStorage` for future visits).

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
