// ============================================================================
// Save as: renderer.js
// ============================================================================

let videoFiles = [];
let converting = false;
let currentFolder = '';
let stats = { total: 0, success: 0, failed: 0 };
let ffmpegInstalled = false;
let customPresets = {};

// Load custom presets from localStorage
function loadCustomPresets() {
  const saved = localStorage.getItem('customPresets');
  if (saved) {
    customPresets = JSON.parse(saved);
    updatePresetDropdown();
  }
}

// Update preset dropdown with custom presets
function updatePresetDropdown() {
  const select = document.getElementById('preset-select');
  
  // Remove old custom presets
  const options = select.querySelectorAll('option');
  options.forEach(opt => {
    if (opt.getAttribute('data-custom') === 'true') {
      opt.remove();
    }
  });
  
  // Add custom presets
  Object.keys(customPresets).forEach(name => {
    const option = document.createElement('option');
    option.value = `custom_${name}`;
    option.textContent = `⭐ ${name}`;
    option.setAttribute('data-custom', 'true');
    select.appendChild(option);
  });
}

// Save current settings as preset
function savePreset() {
  const name = document.getElementById('preset-name').value.trim();
  
  if (!name) {
    alert('Please enter a preset name');
    return;
  }
  
  const settings = {
    height: parseInt(document.getElementById('height').value),
    crf: parseInt(document.getElementById('crf').value),
    audio: parseInt(document.getElementById('audio').value),
    speed: document.getElementById('speed').value,
    codec: document.getElementById('codec').value,
    audioCodec: document.getElementById('audio-codec').value
  };
  
  customPresets[name] = settings;
  localStorage.setItem('customPresets', JSON.stringify(customPresets));
  
  updatePresetDropdown();
  document.getElementById('preset-select').value = `custom_${name}`;
  document.getElementById('status').textContent = `✅ Preset "${name}" saved!`;
}

// Delete selected preset
function deletePreset() {
  const select = document.getElementById('preset-select');
  const value = select.value;
  
  if (!value.startsWith('custom_')) {
    alert('Please select a custom preset to delete');
    return;
  }
  
  const name = value.replace('custom_', '');
  
  if (confirm(`Delete preset "${name}"?`)) {
    delete customPresets[name];
    localStorage.setItem('customPresets', JSON.stringify(customPresets));
    updatePresetDropdown();
    select.value = '';
    document.getElementById('status').textContent = `🗑️ Preset "${name}" deleted`;
  }
}

// Load preset settings
function loadPreset() {
  const value = document.getElementById('preset-select').value;
  
  if (!value) return;
  
  let settings;
  
  // Built-in presets
  if (value === 'tv') {
    settings = { height: 720, crf: 28, audio: 192, speed: 'slow', codec: 'libx264', audioCodec: 'aac' };
  } else if (value === 'movie') {
    settings = { height: 1080, crf: 23, audio: 192, speed: 'slow', codec: 'libx264', audioCodec: 'aac' };
  } else if (value === 'high-quality') {
    settings = { height: 1080, crf: 18, audio: 256, speed: 'slower', codec: 'libx264', audioCodec: 'aac' };
  } else if (value === 'small-size') {
    settings = { height: 720, crf: 30, audio: 128, speed: 'medium', codec: 'libx265', audioCodec: 'aac' };
  } else if (value.startsWith('custom_')) {
    // Custom preset
    const name = value.replace('custom_', '');
    settings = customPresets[name];
    document.getElementById('preset-name').value = name;
  }
  
  if (settings) {
    document.getElementById('height').value = settings.height;
    document.getElementById('crf').value = settings.crf;
    document.getElementById('audio').value = settings.audio;
    document.getElementById('speed').value = settings.speed;
    document.getElementById('codec').value = settings.codec;
    document.getElementById('audio-codec').value = settings.audioCodec;
  }
}

// Check FFmpeg status on load
window.addEventListener('DOMContentLoaded', async () => {
  loadCustomPresets();
  ffmpegInstalled = await window.api.checkFFmpeg();
  updateFFmpegBanner();
});

// Listen for FFmpeg status updates
window.api.onFFmpegStatus((data) => {
  ffmpegInstalled = data.installed;
  updateFFmpegBanner();
});

// Listen for installation progress
window.api.onInstallProgress((message) => {
  document.getElementById('installProgress').textContent = message;
});

function updateFFmpegBanner() {
  const banner = document.getElementById('ffmpegBanner');
  const convertBtn = document.getElementById('convertBtn');
  
  if (ffmpegInstalled) {
    banner.style.display = 'none';
    if (videoFiles.length > 0) {
      convertBtn.disabled = false;
    }
  } else {
    banner.style.display = 'block';
    convertBtn.disabled = true;
  }
}

async function installFFmpeg() {
  const installBtn = document.getElementById('installBtn');
  const progressDiv = document.getElementById('installProgress');
  
  installBtn.disabled = true;
  installBtn.textContent = '⏳ Installing...';
  progressDiv.textContent = 'Starting installation...';
  
  const result = await window.api.installFFmpeg();
  
  if (result.success) {
    progressDiv.textContent = '✅ FFmpeg installed successfully!';
    progressDiv.style.color = '#4caf50';
    setTimeout(() => {
      updateFFmpegBanner();
    }, 2000);
  } else {
    progressDiv.textContent = `❌ ${result.error}`;
    progressDiv.style.color = '#f44336';
    installBtn.disabled = false;
    installBtn.textContent = '🔧 Retry Installation';
  }
}

function applyPreset() {
  const preset = document.getElementById('preset-select').value;
  
  if (preset === 'tv') {
    document.getElementById('crf').value = 28;
    document.getElementById('height').value = 720;
    document.getElementById('audio').value = 192;
    document.getElementById('speed').value = 'slow';
  } else if (preset === 'movie') {
    document.getElementById('crf').value = 23;
    document.getElementById('height').value = 1080;
    document.getElementById('audio').value = 192;
    document.getElementById('speed').value = 'slow';
  }
}

function applyPreset() {
  const preset = document.getElementById('preset-select').value;
  
  if (preset === 'tv') {
    document.getElementById('crf').value = 28;
    document.getElementById('height').value = 720;
    document.getElementById('audio').value = 192;
    document.getElementById('speed').value = 'slow';
  } else if (preset === 'movie') {
    document.getElementById('crf').value = 23;
    document.getElementById('height').value = 1080;
    document.getElementById('audio').value = 192;
    document.getElementById('speed').value = 'slow';
  }
}

async function selectFolder() {
  if (!ffmpegInstalled) {
    document.getElementById('fileListHeader').textContent = '⚠️ Please install FFmpeg first';
    return;
  }
  
  const folder = await window.api.selectFolder();
  if (folder) {
    currentFolder = folder;
    videoFiles = await window.api.getVideoFiles(folder);
    
    document.getElementById('totalFiles').textContent = videoFiles.length;
    document.getElementById('convertBtn').disabled = videoFiles.length === 0;
    
    displayFiles();
  }
}

function displayFiles() {
  const fileList = document.getElementById('fileList');
  const fileListHeader = document.getElementById('fileListHeader');
  
  fileListHeader.textContent = `${videoFiles.length} file(s) ready to convert`;
  
  fileList.innerHTML = videoFiles.map((file, index) => `
    <div class="file-item" id="file-${index}">
      <div class="file-name" title="${file.name}">${file.name}</div>
      <div class="file-details">
        ${file.size} MB → ${file.cleanName}
      </div>
      <div class="progress-bar" style="display: none;">
        <div class="progress-fill" style="width: 0%"></div>
      </div>
    </div>
  `).join('');
}

async function startConversion() {
  if (converting || !ffmpegInstalled) return;
  
  converting = true;
  document.getElementById('convertBtn').disabled = true;
  document.getElementById('fileListHeader').textContent = 'Converting...';
  stats = { total: videoFiles.length, success: 0, failed: 0 };
  
  const settings = {
    crf: parseInt(document.getElementById('crf').value),
    height: parseInt(document.getElementById('height').value),
    width: Math.round(parseInt(document.getElementById('height').value) * 16 / 9),
    audioBitrate: parseInt(document.getElementById('audio').value),
    preset: document.getElementById('speed').value,
    codec: document.getElementById('codec').value,
    audioCodec: document.getElementById('audio-codec').value
  };
  
  for (let i = 0; i < videoFiles.length; i++) {
    const file = videoFiles[i];
    const fileElement = document.getElementById(`file-${i}`);
    const progressBar = fileElement.querySelector('.progress-bar');
    
    progressBar.style.display = 'block';
    document.getElementById('fileListHeader').textContent = `Converting ${i + 1}/${videoFiles.length}: ${file.name}`;
    
    try {
      const result = await window.api.convertFile(file, settings);
      
      if (result.success) {
        stats.success++;
        fileElement.style.borderLeftColor = '#4caf50';
        fileElement.querySelector('.file-details').innerHTML = `
          ✅ ${file.size} MB → ${result.outputSize} MB (Saved ${result.saved} MB)
        `;
      }
    } catch (error) {
      stats.failed++;
      fileElement.style.borderLeftColor = '#f44336';
      fileElement.querySelector('.file-details').innerHTML = `❌ Failed: ${error.error || 'Unknown error'}`;
    }
    
    document.getElementById('successCount').textContent = stats.success;
    document.getElementById('failedCount').textContent = stats.failed;
  }
  
  converting = false;
  if (ffmpegInstalled) {
    document.getElementById('convertBtn').disabled = false;
  }
  document.getElementById('fileListHeader').textContent = `✅ Complete! ${stats.success} succeeded, ${stats.failed} failed`;
}

window.api.onProgress((data) => {
  const index = videoFiles.findIndex(f => f.name === data.file);
  if (index >= 0) {
    const progressFill = document.querySelector(`#file-${index} .progress-fill`);
    if (progressFill) {
      progressFill.style.width = `${Math.min(data.percent, 100)}%`;
    }
  }
});