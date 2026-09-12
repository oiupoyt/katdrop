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
  const fileList = document.getElementById('fileList');
  const fileCount = document.getElementById('fileCount');
  const toastEl = document.getElementById('toast');

  let selectedFiles = [];

  // API Base configuration for remote frontend (Netlify) or local hosting
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('api')) {
    const customApi = urlParams.get('api').replace(/\/+$/, '');
    localStorage.setItem('katdrop_api', customApi);
  }
  const API_BASE = window.KATDROP_API || localStorage.getItem('katdrop_api') || '';

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

  // Interactive Particle Background
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

    // Mouse tracking for interactivity
    const mouse = {
      x: null,
      y: null,
      radius: 140
    };

    window.addEventListener('mousemove', e => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });

    window.addEventListener('mouseleave', () => {
      mouse.x = null;
      mouse.y = null;
    });

    // Click to push particles slightly
    window.addEventListener('click', e => {
      for (const p of particles) {
        const dx = p.x - e.clientX;
        const dy = p.y - e.clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 180 && dist > 0) {
          const force = (180 - dist) / 180;
          p.vx += (dx / dist) * force * 3;
          p.vy += (dy / dist) * force * 3;
        }
      }
    });

    const particles = [];
    const count = Math.min(50, Math.floor(width / 26));

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        radius: Math.random() * 1.5 + 1
      });
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);

      // Connect particles to each other
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 115) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.06 * (1 - dist / 115)})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Update & draw particles + connect to mouse
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        // Dampen velocity back to normal
        p.vx *= 0.985;
        p.vy *= 0.985;

        // Boundary bounce
        if (p.x < 0) { p.x = 0; p.vx *= -1; }
        if (p.x > width) { p.x = width; p.vx *= -1; }
        if (p.y < 0) { p.y = 0; p.vy *= -1; }
        if (p.y > height) { p.y = height; p.vy *= -1; }

        // Interaction with mouse cursor
        if (mouse.x !== null && mouse.y !== null) {
          const mdx = mouse.x - p.x;
          const mdy = mouse.y - p.y;
          const mDist = Math.sqrt(mdx * mdx + mdy * mdy);

          if (mDist < mouse.radius) {
            // Connect line to mouse
            ctx.strokeStyle = `rgba(77, 184, 255, ${0.18 * (1 - mDist / mouse.radius)})`;
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();

            // Repel gently if very close
            if (mDist < 70 && mDist > 0) {
              const repel = (70 - mDist) / 70;
              p.x -= (mdx / mDist) * repel * 1.5;
              p.y -= (mdy / mDist) * repel * 1.5;
            }
          }
        }

        // Draw particle dot
        ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      requestAnimationFrame(animate);
    }

    animate();
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
      const res = await fetch(`${API_BASE}/files`);
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
      const res = await fetch(`${API_BASE}/delete/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('file deleted');
        setTimeout(() => {
          fetchFiles();
        }, 180);
      } else {
        if (cardElement) cardElement.classList.remove('deleting');
        showToast('failed to delete');
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

  // Upload files with smooth progress bar
  function uploadSelectedFiles() {
    if (selectedFiles.length === 0) return;

    const formData = new FormData();
    selectedFiles.forEach(f => formData.append('file', f));

    progressWrap.classList.add('active');
    progressBar.style.width = '0%';
    uploadBtn.disabled = true;

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        progressBar.style.width = `${pct}%`;
      }
    });

    xhr.onload = () => {
      progressBar.style.width = '100%';
      setTimeout(() => {
        progressWrap.classList.remove('active');
        progressBar.style.width = '0%';
        fileInput.value = '';
        updateFileSelection([]);
        fetchFiles();
        showToast('upload complete');
      }, 250);
    };

    xhr.onerror = () => {
      progressWrap.classList.remove('active');
      uploadBtn.disabled = false;
      showToast('upload failed');
    };

    xhr.open('POST', `${API_BASE}/upload`);
    xhr.send(formData);
  }

  // Listeners
  fileInput.addEventListener('change', e => {
    updateFileSelection(e.target.files);
  });

  uploadBtn.addEventListener('click', () => {
    uploadSelectedFiles();
  });

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
  fetchFiles();
})();
