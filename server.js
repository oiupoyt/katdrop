const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.disable('x-powered-by');
let currentPort = parseInt(process.env.PORT, 10) || 3000;

// Directories
const uploadDir = path.join(__dirname, 'uploads');
const publicDir = path.join(__dirname, 'public');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Security & Quota Constants
const FILE_TTL_MS = 10 * 60 * 1000; // 10 Minutes File Expiration
const MAX_TOTAL_STORAGE_BYTES = 4 * 1024 * 1024 * 1024; // 4GB Max Storage Quota
const MAX_FILE_SIZE_BYTES = 1024 * 1024 * 1024; // 1GB Max per file

// In-Memory Security Stores
const deleteTokens = new Map(); // filename -> deleteToken
const rateLimitMap = new Map(); // ip -> { count, resetTime }
const uploadRateLimitMap = new Map(); // ip -> { count, resetTime }

// Utility: Client IP extraction
function getClientIp(req) {
  const cf = req.headers['cf-connecting-ip'];
  if (cf) return String(cf).trim();
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.socket.remoteAddress || '127.0.0.1';
}

// Utility: format file size
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Utility: Total directory storage calculator
async function getTotalUploadSize() {
  try {
    const entries = await fs.promises.readdir(uploadDir);
    let total = 0;
    for (const name of entries) {
      if (name.startsWith('.')) continue;
      const stats = await fs.promises.stat(path.join(uploadDir, name)).catch(() => null);
      if (stats && stats.isFile()) total += stats.size;
    }
    return total;
  } catch {
    return 0;
  }
}

// Utility: Safe unique filename (prevents directory traversal, collision, and shell injection)
function getSafeUniqueName(destination, originalName) {
  // Sanitize: strip dangerous chars, limit length, prevent dotfile creation
  const base = path.basename(originalName).replace(/[^\w\s.-]/gi, '_').replace(/^\.+/, '').trim() || 'file';
  const ext = path.extname(base).slice(0, 16);
  const nameOnly = (path.basename(base, ext) || 'file').slice(0, 120);

  let candidate = `${nameOnly}${ext}`;
  let counter = 1;
  while (fs.existsSync(path.join(destination, candidate))) {
    candidate = `${nameOnly} (${counter})${ext}`;
    counter++;
  }
  return candidate;
}

// Utility: Validate path and prevent directory traversal
function getSafeFilePath(filename) {
  if (!filename || typeof filename !== 'string') return null;
  const safeName = path.basename(filename);
  if (safeName.startsWith('.')) return null; // Reject hidden files
  const resolvedPath = path.resolve(uploadDir, safeName);
  if (!resolvedPath.startsWith(uploadDir + path.sep) && resolvedPath !== uploadDir) {
    return null;
  }
  return { resolvedPath, safeName };
}

// Automatic cleanup of expired files (older than 10 minutes)
async function cleanupExpiredFiles() {
  try {
    const entries = await fs.promises.readdir(uploadDir);
    const now = Date.now();

    for (const name of entries) {
      if (name.startsWith('.')) continue; // Preserve .gitkeep and hidden files
      const fullPath = path.join(uploadDir, name);
      try {
        const stats = await fs.promises.stat(fullPath);
        if (stats.isFile() && (now - stats.mtimeMs) >= FILE_TTL_MS) {
          await fs.promises.unlink(fullPath);
          deleteTokens.delete(name);
        }
      } catch (err) {
        // Ignore files already deleted or locked
      }
    }

    // Clean up expired rate limiter maps
    for (const [ip, entry] of rateLimitMap.entries()) {
      if (now > entry.resetTime + 60000) rateLimitMap.delete(ip);
    }
    for (const [ip, entry] of uploadRateLimitMap.entries()) {
      if (now > entry.resetTime + 60000) uploadRateLimitMap.delete(ip);
    }
  } catch (err) {
    // Ignore read errors during sweep
  }
}

// Run cleanup sweep every 60 seconds (unref'd to prevent blocking process exit)
const cleanupInterval = setInterval(cleanupExpiredFiles, 60 * 1000);
cleanupInterval.unref();

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    cb(null, getSafeUniqueName(uploadDir, file.originalname));
  }
});
const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES, // 1GB
    files: 10 // Max 10 files per upload batch
  }
});

// Security & Rate Limiting Middlewares
function generalRateLimiter(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, resetTime: now + 60000 };
  if (now > entry.resetTime) {
    entry.count = 0;
    entry.resetTime = now + 60000;
  }
  entry.count++;
  rateLimitMap.set(ip, entry);
  if (entry.count > 120) {
    return res.status(429).json({ error: 'Too many requests, please slow down.' });
  }
  next();
}

function uploadRateLimiter(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  const entry = uploadRateLimitMap.get(ip) || { count: 0, resetTime: now + 300000 };
  if (now > entry.resetTime) {
    entry.count = 0;
    entry.resetTime = now + 300000;
  }
  entry.count++;
  uploadRateLimitMap.set(ip, entry);
  if (entry.count > 25) {
    return res.status(429).json({ error: 'Upload rate limit reached (max 25 uploads per 5 minutes).' });
  }
  next();
}

// Storage Quota Guard Middleware
async function storageQuotaGuard(req, res, next) {
  const currentSize = await getTotalUploadSize();
  const incomingLength = parseInt(req.headers['content-length'] || '0', 10);
  if (currentSize + incomingLength > MAX_TOTAL_STORAGE_BYTES) {
    return res.status(507).json({
      error: 'Storage quota full (4GB cap). Please wait for older files to expire.'
    });
  }
  next();
}

// CORS & Hardened Security Headers Middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    try {
      const url = new URL(origin);
      const host = url.hostname;
      if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host.endsWith('.oiupoyt.space') ||
        host === 'oiupoyt.space' ||
        host.startsWith('192.168.') ||
        host.startsWith('10.') ||
        host.startsWith('172.16.')
      ) {
        res.header('Access-Control-Allow-Origin', origin);
      }
    } catch {
      // Invalid origin URL
    }
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-delete-token');
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'SAMEORIGIN');
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(generalRateLimiter);
app.use(express.json());
app.use(express.static(publicDir, { maxAge: '1h', etag: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: Date.now()
  });
});

// Upload endpoint (supports single or multiple files with rate-limiting and quota protection)
app.post(
  '/upload',
  uploadRateLimiter,
  storageQuotaGuard,
  upload.array('file', 10),
  (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const now = Date.now();
    const uploaded = req.files.map(f => {
      // Generate unguessable deletion token so only uploader can manually delete before 10-min TTL
      const deleteToken = crypto.randomBytes(16).toString('hex');
      deleteTokens.set(f.filename, deleteToken);

      return {
        name: f.filename,
        size: f.size,
        sizeFormatted: formatBytes(f.size),
        expiresAt: new Date(now + FILE_TTL_MS).toISOString(),
        remainingSeconds: Math.floor(FILE_TTL_MS / 1000),
        deleteToken
      };
    });

    res.json({ success: true, files: uploaded });
  }
);

// List files with metadata, remaining TTL, and on-demand expiration check
app.get('/files', async (req, res) => {
  try {
    const entries = await fs.promises.readdir(uploadDir);
    const files = [];
    const now = Date.now();

    for (const name of entries) {
      if (name.startsWith('.')) continue;
      const fullPath = path.join(uploadDir, name);
      try {
        const stats = await fs.promises.stat(fullPath);
        if (!stats.isFile()) continue;

        const ageMs = now - stats.mtimeMs;
        // Immediate purge if expired
        if (ageMs >= FILE_TTL_MS) {
          fs.promises.unlink(fullPath).catch(() => {});
          deleteTokens.delete(name);
          continue;
        }

        const remainingMs = Math.max(0, FILE_TTL_MS - ageMs);
        const remainingSeconds = Math.ceil(remainingMs / 1000);

        files.push({
          name,
          size: stats.size,
          sizeFormatted: formatBytes(stats.size),
          modifiedAt: stats.mtime,
          expiresAt: new Date(stats.mtimeMs + FILE_TTL_MS).toISOString(),
          remainingSeconds
        });
      } catch (e) {
        continue;
      }
    }

    // Sort newest first
    files.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: 'Error reading files' });
  }
});

// Download / direct link with on-demand expiration check and anti-XSS isolation
app.get('/uploads/:filename', (req, res) => {
  const safe = getSafeFilePath(req.params.filename);
  if (!safe || !fs.existsSync(safe.resolvedPath)) {
    return res.status(404).send('File not found');
  }

  try {
    const stats = fs.statSync(safe.resolvedPath);
    if ((Date.now() - stats.mtimeMs) >= FILE_TTL_MS) {
      fs.unlink(safe.resolvedPath, () => {});
      deleteTokens.delete(safe.safeName);
      return res.status(410).send('File expired');
    }
  } catch (err) {
    return res.status(404).send('File not found');
  }

  // Enforce Sandbox & Download attachment to prevent stored XSS from malicious SVG/HTML uploads
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-transform');
  res.download(safe.resolvedPath, safe.safeName);
});

// Secure Delete endpoint (requires matching delete token generated on upload)
app.delete('/delete/:filename', async (req, res) => {
  const safe = getSafeFilePath(req.params.filename);
  if (!safe) return res.status(400).send('Invalid filename');

  const expectedToken = deleteTokens.get(safe.safeName);
  const clientToken = req.headers['x-delete-token'] || req.query.token;

  // Verify deletion token if present in record
  if (expectedToken && (!clientToken || clientToken !== expectedToken)) {
    return res.status(403).json({ error: 'Unauthorized: Invalid or missing delete token' });
  }

  try {
    await fs.promises.unlink(safe.resolvedPath);
    deleteTokens.delete(safe.safeName);
    res.send('File deleted');
  } catch (err) {
    res.status(500).send('Error deleting file');
  }
});

// Multer error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File exceeds 1GB limit.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Max 10 files per upload batch.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
  next();
});

// Start Server with fallback port handling
function startServer(port, maxAttempts = 10) {
  const server = app.listen(port, '0.0.0.0', () => {
    currentPort = port;
    console.log(`\nkatdrop running on http://localhost:${port}\n`);
    cleanupExpiredFiles(); // Run initial cleanup on startup
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && !process.env.PORT && maxAttempts > 0) {
      startServer(port + 1, maxAttempts - 1);
    } else {
      console.error(`Failed to start server on port ${port}:`, err.message);
      process.exit(1);
    }
  });
}

startServer(currentPort);
