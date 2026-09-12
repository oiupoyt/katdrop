# katdrop

a minimal, smooth file transfer service with 10-minute auto-deletion.

> **Note**: This repository uses a placeholder backend URL (`https://YOUR_BACKEND_URL.trycloudflare.com`) so no private endpoints are exposed publicly.

## features

- minimal dark interface with smooth interactive particle background
- real-time backend status indicator (`online` / `offline`)
- live upload byte progress and percentage
- drag & drop files anywhere to upload instantly
- 10-minute auto-deletion timer per file with live countdown
- safe path verification and collision-free file naming
- zero external CDN dependencies (works completely offline)

## configuration

### connecting your frontend to your backend

To connect your deployed frontend to your private backend (e.g. Cloudflare Tunnel or local server), pass your API URL via URL parameters once:

```
https://katdrop.oiupoyt.space/?api=https://your-tunnel.trycloudflare.com
```

katdrop will automatically save this to `localStorage` in your browser.

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
