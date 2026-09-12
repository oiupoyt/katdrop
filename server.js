const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
let currentPort = parseInt(process.env.PORT, 10) || 3000;

// Directories
const uploadDir = path.join(__dirname, 'uploads');
const publicDir = path.join(__dirname, 'public');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 10-Minute File Expiration (in milliseconds)
const FILE_TTL_MS = 10 * 60 * 1000;

// Utility: format file size
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Utility: Safe unique filename (prevent overwrites and directory traversal)
function getSafeUniqueName(destination, originalName) {
  const base = path.basename(originalName).replace(/[^\w\s.-]/gi, '_').trim() || 'file';
  const ext = path.extname(base);
  const nameOnly = path.basename(base, ext) || 'file';

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
        }
      } catch (err) {
        // Ignore files already deleted or locked
      }
    }
  } catch (err) {
    // Ignore read errors during sweep
  }
}

// Run cleanup sweep every 10 seconds (unref'd to prevent blocking process exit)
const cleanupInterval = setInterval(cleanupExpiredFiles, 10 * 1000);
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
  limits: { fileSize: 2 * 1024 * 1024 * 1024 } // 2GB
});

// Middlewares
app.use(express.json());
app.use(express.static(publicDir));

// Upload endpoint (supports single or multiple files)
app.post('/upload', upload.array('file', 20), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const now = Date.now();
  const uploaded = req.files.map(f => ({
    name: f.filename,
    size: f.size,
    sizeFormatted: formatBytes(f.size),
    expiresAt: new Date(now + FILE_TTL_MS).toISOString(),
    remainingSeconds: Math.floor(FILE_TTL_MS / 1000)
  }));
  res.json({ success: true, files: uploaded });
});

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

// Download / direct link with on-demand expiration check
app.get('/uploads/:filename', (req, res) => {
  const safe = getSafeFilePath(req.params.filename);
  if (!safe || !fs.existsSync(safe.resolvedPath)) {
    return res.status(404).send('File not found');
  }

  try {
    const stats = fs.statSync(safe.resolvedPath);
    if ((Date.now() - stats.mtimeMs) >= FILE_TTL_MS) {
      fs.unlink(safe.resolvedPath, () => {});
      return res.status(410).send('File expired');
    }
  } catch (err) {
    return res.status(404).send('File not found');
  }

  res.download(safe.resolvedPath, safe.safeName);
});

// Delete file
app.delete('/delete/:filename', async (req, res) => {
  const safe = getSafeFilePath(req.params.filename);
  if (!safe) return res.status(400).send('Invalid filename');

  try {
    await fs.promises.unlink(safe.resolvedPath);
    res.send('File deleted');
  } catch (err) {
    res.status(500).send('Error deleting file');
  }
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
