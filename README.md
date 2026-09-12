# katdrop

a minimal, smooth file transfer service with 10-minute auto-deletion.

> **Note**: This repository uses a placeholder backend URL (`https://YOUR_BACKEND_URL.trycloudflare.com`) and placeholder API key (`YOUR_API_KEY_HERE`) so no private endpoints or keys are exposed publicly.

## features

- minimal dark interface with smooth interactive particle background
- real-time backend status indicator (`online` / `offline`)
- live upload byte progress and percentage
- drag & drop files anywhere to upload instantly
- 10-minute auto-deletion timer per file with live countdown
- safe path verification and collision-free file naming
- optional API key authorization (`x-katdrop-key`)
- zero external CDN dependencies (works completely offline)

## configuration

### connecting your frontend (Netlify) to your backend

To connect your deployed frontend to your private backend (e.g. Cloudflare Tunnel or local server), pass your API URL and optional key via URL parameters once:

```
https://your-site.netlify.app/?api=https://your-tunnel.trycloudflare.com&key=YOUR_SECRET_KEY
```

KatDrop will automatically save these to `localStorage` in your browser.

### backend API key (optional)

To require an API key on your backend, set `KATDROP_KEY`:

```bash
KATDROP_KEY=mysecretkey npm start
```

If not set, the backend runs without key verification.

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
