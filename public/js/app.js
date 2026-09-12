/**
 * katdrop - minimal, smooth, and interactive
 */
(function () {
  'use strict';

  // DOM Elements
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const uploadBtn = document.getElementById('uploadBtn');
  const fileSelection = document.getElementById('fileSelection');
  const progressWrap = document.getElementById('progressWrap');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const fileList = document.getElementById('fileList');
  const fileCount = document.getElementById('fileCount');
  const backendStatus = document.getElementById('backendStatus');
  const statusText = document.getElementById('statusText');
  const toastEl = document.getElementById('toast');

  let selectedFiles = [];

  // API Configuration (permanent default backend)
  const DEFAULT_REMOTE_API = 'https://katdrop-api.oiupoyt.space';
  // Purge any legacy ephemeral trycloudflare or placeholder URLs from localStorage
  const savedApi = localStorage.getItem('katdrop_api');
  if (savedApi && (savedApi.includes('trycloudflare.com') || savedApi.includes('YOUR_BACKEND_URL'))) {
    localStorage.removeItem('katdrop_api');
  }
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('api')) {
    const customApi = urlParams.get('api').replace(/\/+$/, '');
    localStorage.setItem('katdrop_api', customApi);
  }
  const isLocalOrigin = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('192.168.');
  const API_BASE = window.KATDROP_API || localStorage.getItem('katdrop_api') || (isLocalOrigin ? '' : DEFAULT_REMOTE_API);

  // Fetch helper
  function apiFetch(url, options = {}) {
    return fetch(url, options);
  }

  // Toast
  let toastTimeout;
  function showToast(msg) {
    clearTimeout(toastTimeout);
    toastEl.textContent = `// ${msg}`;
    toastEl.classList.add('show');
    toastTimeout = setTimeout(() => {
      toastEl.classList.remove('show');
    }, 2200);
  }

  // Utility: Format bytes
  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Backend Status Check
  async function checkBackendStatus() {
    if (!backendStatus || !statusText) return;
    backendStatus.className = 'backend-status checking';
    statusText.textContent = 'checking...';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await apiFetch(`${API_BASE}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        backendStatus.className = 'backend-status online';
        statusText.textContent = 'online';
      } else {
        throw new Error('Non-200');
      }
    } catch (err) {
      backendStatus.className = 'backend-status offline';
      statusText.textContent = 'offline';
    }
  }

  // Autonomous & Interactive Particle Background
  function initInteractiveParticles() {
    const canvas = document.getElementById('particles');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    // Mouse & Touch tracking for interactivity
    const pointer = {
      x: null,
      y: null,
      radius: 150
    };

    window.addEventListener('mousemove', e => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    });

    window.addEventListener('mouseleave', () => {
      pointer.x = null;
      pointer.y = null;
    });

    window.addEventListener('touchmove', e => {
      if (e.touches.length > 0) {
        pointer.x = e.touches[0].clientX;
        pointer.y = e.touches[0].clientY;
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      pointer.x = null;
      pointer.y = null;
    });

    // Click to push particles outward
    window.addEventListener('click', e => {
      for (const p of particles) {
        const dx = p.x - e.clientX;
        const dy = p.y - e.clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 220 && dist > 0) {
          const force = (220 - dist) / 220;
          p.disturbVx += (dx / dist) * force * 4;
          p.disturbVy += (dy / dist) * force * 4;
        }
      }
    });

    const particles = [];
    const count = Math.min(80, Math.max(35, Math.floor(width / 20)));

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.35 + Math.random() * 0.45;
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        baseVx: Math.cos(angle) * speed,
        baseVy: Math.sin(angle) * speed,
        disturbVx: 0,
        disturbVy: 0,
        radius: Math.random() * 1.5 + 1,
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.0018 + Math.random() * 0.0025
      });
    }

    function animate(time) {
      ctx.clearRect(0, 0, width, height);

      // Connect particles to each other (constellation network)
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distSq = dx * dx + dy * dy;
          if (distSq < 15625) { // 125px
            const dist = Math.sqrt(distSq);
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.075 * (1 - dist / 125)})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Update & draw each particle
      for (const p of particles) {
        // Continuous organic autonomous motion: base velocity + subtle harmonic wave drift
        const waveX = Math.sin(time * 0.0012 + p.phase) * 0.22;
        const waveY = Math.cos(time * 0.0015 + p.phase) * 0.22;

        p.x += p.baseVx + p.disturbVx + waveX;
        p.y += p.baseVy + p.disturbVy + waveY;

        // Dampen interactive disturbance back to zero (leaves autonomous base speed intact)
        p.disturbVx *= 0.94;
        p.disturbVy *= 0.94;

        // Seamless boundary wrap with padding so particles never bunch at edges
        const pad = 15;
        if (p.x < -pad) p.x = width + pad;
        if (p.x > width + pad) p.x = -pad;
        if (p.y < -pad) p.y = height + pad;
        if (p.y > height + pad) p.y = -pad;

        // Interaction with mouse/touch pointer
        if (pointer.x !== null && pointer.y !== null) {
          const mdx = pointer.x - p.x;
          const mdy = pointer.y - p.y;
          const mDistSq = mdx * mdx + mdy * mdy;

          if (mDistSq < pointer.radius * pointer.radius) {
            const mDist = Math.sqrt(mDistSq);
            // Connect line to pointer
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 * (1 - mDist / pointer.radius)})`;
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(pointer.x, pointer.y);
            ctx.stroke();

            // Repel gently if close
            if (mDist < 75 && mDist > 0) {
              const repel = (75 - mDist) / 75;
              p.disturbVx -= (mdx / mDist) * repel * 1.6;
              p.disturbVy -= (mdy / mDist) * repel * 1.6;
            }
          }
        }

        // Breathing particle glow
        const alpha = 0.25 + Math.sin(time * p.twinkleSpeed + p.phase) * 0.14;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }

  // Safe HTML helper
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Countdown Timer Management
  let countdownTimer = null;

  function formatTimeLeft(seconds) {
    if (seconds <= 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function tickCountdowns() {
    const timerEls = document.querySelectorAll('.file-timer');
    if (timerEls.length === 0) return;

    const now = Date.now();
    let hasExpired = false;

    timerEls.forEach(el => {
      const expires = parseInt(el.dataset.expiresMs, 10);
      if (isNaN(expires)) return;

      const remainingSec = Math.max(0, Math.ceil((expires - now) / 1000));
      el.textContent = formatTimeLeft(remainingSec);

      if (remainingSec <= 30) {
        el.className = 'file-timer critical';
      } else if (remainingSec <= 120) {
        el.className = 'file-timer warning';
      } else {
        el.className = 'file-timer';
      }

      if (remainingSec === 0) {
        hasExpired = true;
        const card = el.closest('li.file-card');
        if (card) card.classList.add('deleting');
      }
    });

    if (hasExpired) {
      setTimeout(fetchFiles, 400);
    }
  }

  function startCountdownLoop() {
    if (countdownTimer) clearInterval(countdownTimer);
    tickCountdowns();
    countdownTimer = setInterval(tickCountdowns, 1000);
  }

  // Fetch and display files
  async function fetchFiles() {
    try {
      const res = await apiFetch(`${API_BASE}/files`);
      const files = await res.json();
      fileList.innerHTML = '';

      if (!files || files.length === 0) {
        fileList.innerHTML = '<li class="empty-state">// no files uploaded yet</li>';
        if (fileCount) fileCount.textContent = '0 files';
        return;
      }

      if (fileCount) {
        fileCount.textContent = `${files.length} file${files.length === 1 ? '' : 's'}`;
      }

      files.forEach(file => {
        const li = document.createElement('li');
        li.className = 'file-card';
        const name = typeof file === 'string' ? file : file.name;
        const size = typeof file === 'object' && file.sizeFormatted ? file.sizeFormatted : '';
        const expiresMs = file.expiresAt ? new Date(file.expiresAt).getTime() : (Date.now() + 600000);
        const remainingSec = Math.max(0, Math.ceil((expiresMs - Date.now()) / 1000));
        li.innerHTML = `
          <div class="file-info">
            <span class="file-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
            <div class="file-meta">
              ${size ? `<span class="file-size">${escapeHtml(size)}</span>` : ''}
              <span class="file-timer" data-expires-ms="${expiresMs}" title="Auto-deletes in">${formatTimeLeft(remainingSec)}</span>
            </div>
          </div>
          <div class="file-actions">
            <a href="${API_BASE}/uploads/${encodeURIComponent(name)}" class="action-btn action-download" download>download</a>
            <button class="action-btn action-delete" onclick="deleteFile('${escapeHtml(name)}', this.closest('li'))">delete</button>
          </div>
        `;
        fileList.appendChild(li);
      });

      startCountdownLoop();
    } catch (err) {
      console.error(err);
      fileList.innerHTML = '<li class="empty-state">// error reading files</li>';
    }
  }

  // Delete file with smooth animation
  window.deleteFile = async function (filename, cardElement) {
    if (cardElement) cardElement.classList.add('deleting');

    try {
      const res = await apiFetch(`${API_BASE}/delete/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('file deleted');
        setTimeout(() => {
          fetchFiles();
        }, 180);
      } else {
        if (cardElement) cardElement.classList.remove('deleting');
        const err = await res.json().catch(() => null);
        showToast(err && err.error ? err.error : 'failed to delete');
      }
    } catch (err) {
      if (cardElement) cardElement.classList.remove('deleting');
      showToast('delete error');
    }
  };

  // Update selected files
  function updateFileSelection(files) {
    selectedFiles = Array.from(files);
    if (selectedFiles.length === 0) {
      fileSelection.textContent = '';
      fileSelection.classList.remove('active');
      uploadBtn.disabled = true;
    } else if (selectedFiles.length === 1) {
      fileSelection.textContent = `> ${selectedFiles[0].name}`;
      fileSelection.classList.add('active');
      uploadBtn.disabled = false;
    } else {
      fileSelection.textContent = `> ${selectedFiles.length} files selected`;
      fileSelection.classList.add('active');
      uploadBtn.disabled = false;
    }
  }

  // 16MB Chunk Size (safely bypasses Cloudflare 100MB body limit & connection timeouts on Wi-Fi)
  const CHUNK_SIZE = 16 * 1024 * 1024;

  async function uploadSingleFile(file, overallIndex, totalFiles) {
    const fileLabel = totalFiles > 1 ? `[${overallIndex + 1}/${totalFiles}] ` : '';

    if (file.size <= CHUNK_SIZE) {
      // Direct standard upload
      const formData = new FormData();
      formData.append('file', file);

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', e => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            progressBar.style.width = `${pct}%`;
            if (progressText) {
              progressText.textContent = `${fileLabel}uploading: ${pct}% (${formatBytes(e.loaded)} / ${formatBytes(e.total)})`;
            }
          }
        });

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            let msg = 'upload failed';
            try {
              const res = JSON.parse(xhr.responseText);
              if (res && res.error) msg = res.error;
            } catch {}
            reject(new Error(msg));
          }
        };

        xhr.onerror = () => reject(new Error('upload connection failed'));
        xhr.open('POST', `${API_BASE}/upload`);
        xhr.send(formData);
      });
    } else {
      // Chunked slice upload for files > 75MB (200MB, 500MB, 1GB+)
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const uploadId = 'up_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
      let uploadedBytes = 0;

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(file.size, start + CHUNK_SIZE);
        const chunk = file.slice(start, end);

        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.addEventListener('progress', e => {
            if (e.lengthComputable) {
              const currentTotal = uploadedBytes + e.loaded;
              const pct = Math.min(99, Math.round((currentTotal / file.size) * 100));
              progressBar.style.width = `${pct}%`;
              if (progressText) {
                progressText.textContent = `${fileLabel}uploading: ${pct}% (${formatBytes(currentTotal)} / ${formatBytes(file.size)})`;
              }
            }
          });

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              uploadedBytes += (end - start);
              resolve();
            } else {
              let msg = 'chunk upload failed';
              try {
                const res = JSON.parse(xhr.responseText);
                if (res && res.error) msg = res.error;
              } catch {}
              reject(new Error(msg));
            }
          };

          xhr.onerror = () => reject(new Error('chunk upload connection failed'));
          const url = `${API_BASE}/upload/chunk?uploadId=${encodeURIComponent(uploadId)}&chunkIndex=${i}&totalChunks=${totalChunks}&filename=${encodeURIComponent(file.name)}&totalSize=${file.size}`;
          xhr.open('POST', url);
          xhr.setRequestHeader('Content-Type', 'application/octet-stream');
          xhr.send(chunk);
        });
      }
    }
  }

  // Upload files with smooth progress bar
  async function uploadSelectedFiles() {
    if (selectedFiles.length === 0) return;

    progressWrap.classList.add('active');
    progressBar.style.width = '0%';
    uploadBtn.disabled = true;

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        await uploadSingleFile(selectedFiles[i], i, selectedFiles.length);
      }

      progressBar.style.width = '100%';
      if (progressText) progressText.textContent = 'processing...';
      setTimeout(() => {
        progressWrap.classList.remove('active');
        progressBar.style.width = '0%';
        if (progressText) progressText.textContent = '';
        fileInput.value = '';
        updateFileSelection([]);
        fetchFiles();
        showToast('upload complete');
      }, 250);
    } catch (err) {
      progressWrap.classList.remove('active');
      uploadBtn.disabled = false;
      if (progressText) progressText.textContent = '';
      showToast(err.message || 'upload failed');
      checkBackendStatus();
    }
  }

  // Listeners
  fileInput.addEventListener('change', e => {
    updateFileSelection(e.target.files);
  });

  uploadBtn.addEventListener('click', () => {
    uploadSelectedFiles();
  });

  if (backendStatus) {
    backendStatus.addEventListener('click', () => {
      checkBackendStatus();
      fetchFiles();
    });
  }

  // Drag and drop
  ['dragenter', 'dragover'].forEach(name => {
    dropZone.addEventListener(name, e => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    window.addEventListener(name, e => e.preventDefault());
  });

  ['dragleave', 'drop'].forEach(name => {
    dropZone.addEventListener(name, e => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    });
    window.addEventListener(name, e => e.preventDefault());
  });

  dropZone.addEventListener('drop', e => {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      updateFileSelection(e.dataTransfer.files);
      uploadSelectedFiles();
    }
  });

  // Init
  initInteractiveParticles();
  checkBackendStatus();
  fetchFiles();
  setInterval(checkBackendStatus, 15000);
})();
