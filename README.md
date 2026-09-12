# katdrop

a minimal, smooth file transfer service.

## features

- minimal dark interface with smooth interactive particle background
- drag & drop files anywhere to upload instantly
- 10-minute auto-deletion timer per file with live countdown
- sleek upload progress bar
- safe path verification and collision-free file naming
- zero external CDN dependencies (works completely offline)

## usage

```bash
# install dependencies
npm install

# start server
npm start
```

Runs by default on `http://localhost:3000` (or falls back to an available port if 3000 is in use).

## endpoints

- `POST /upload` - upload files (`file`)
- `GET /files` - list files
- `GET /uploads/:filename` - download file
- `DELETE /delete/:filename` - delete file

## license

MIT
