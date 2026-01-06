// State
let files = [];
let converting = false;
let currentFileIndex = 0;
let successCount = 0;
let failCount = 0;
let totalSpaceSaved = 0;
let customPresets = loadPresets();

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializeTabs();
  initializeButtons();
  initializeSettings();
  initializePresets();
  updateCustomPresetList();
  checkFFmpeg();
  log('Application ready', 'info');
});

// Load presets from localStorage
function loadPresets() {
  try {
    const saved = localStorage.getItem('customPresets');
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    return [];
  }
}

// Save presets to localStorage
function savePresets() {
  try {
    localStorage.setItem('customPresets', JSON.stringify(customPresets));
  } catch (error) {
    log('Failed to save presets', 'error');
  }
}

// Update custom preset list
function updateCustomPresetList() {
  const container = document.getElementById('custom-preset-list');
  if (customPresets.length === 0) {
    container.innerHTML = '<div class="text-gray-500 text-xs text-center py-2">No custom presets yet</div>';
    return;
  }
  
  container.innerHTML = '';
  customPresets.forEach((preset, index) => {
    const div = document.createElement('div');
    div.className = 'flex items-center gap-2 p-2 bg-gray-800 rounded hover:bg-gray-700 transition-colors';
    div.innerHTML = `
      <button class="flex-1 text-left text-sm font-medium" onclick="applyCustomPreset(${index})">
        ${preset.name}
      </button>
      <button onclick="deletePreset(${index})" class="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs transition-colors">
        ✕
      </button>
    `;
    container.appendChild(div);
  });
}

// Apply custom preset
function applyCustomPreset(index) {
  const preset = customPresets[index];
  if (preset) {
    applyPreset(preset.settings);
    log(`Applied preset: ${preset.name}`, 'info');
  }
}

// Delete preset
function deletePreset(index) {
  if (confirm(`Delete preset "${customPresets[index].name}"?`)) {
    customPresets.splice(index, 1);
    savePresets();
    updateCustomPresetList();
    log('Preset deleted', 'info');
  }
}

// Save new preset
function saveNewPreset() {
  const name = document.getElementById('preset-name').value.trim();
  if (!name) {
    log('Please enter a preset name', 'warn');
    return;
  }
  
  const settings = getCurrentSettings();
  customPresets.push({ name, settings });
  savePresets();
  updateCustomPresetList();
  document.getElementById('preset-name').value = '';
  log(`Saved preset: ${name}`, 'success');
}

// Get current settings
function getCurrentSettings() {
  return {
    container: document.getElementById('container').value,
    videoCodec: document.getElementById('videoCodec').value,
    audioCodec: document.getElementById('audioCodec').value,
    resolution: document.getElementById('resolution').value,
    crf: document.getElementById('crf').value,
    preset: document.getElementById('preset').value,
    audioBitrate: document.getElementById('audio-bitrate').value
  };
}

// Format bytes to human readable
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Tab switching
function initializeTabs() {
  const tabs = document.querySelectorAll('.tab-button');
  const contents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      
      // Remove active from all tabs
      tabs.forEach(t => t.classList.remove('active'));
      // Add active to clicked tab
      tab.classList.add('active');
      
      // Hide all content
      contents.forEach(c => c.classList.remove('active'));
      // Show selected content
      const activeContent = document.getElementById(`tab-${tabName}`);
      if (activeContent) {
        activeContent.classList.add('active');
      }
    });
  });
}

// Check FFmpeg availability
async function checkFFmpeg() {
  const result = await window.electronAPI.checkFFmpeg();
  if (result.available) {
    log('✓ FFmpeg and FFprobe detected', 'success');
  } else {
    log('⚠ FFmpeg not found - install will happen automatically', 'warn');
  }
}

// Button event listeners
function initializeButtons() {
  document.getElementById('folder-btn').addEventListener('click', selectFolder);
  document.getElementById('files-btn').addEventListener('click', selectFiles);
  document.getElementById('clear-btn').addEventListener('click', clearFiles);
  document.getElementById('convert-btn').addEventListener('click', startConversion);
  document.getElementById('stop-btn').addEventListener('click', stopConversion);
  document.getElementById('clear-log-btn').addEventListener('click', clearLog);
  document.getElementById('save-preset').addEventListener('click', saveNewPreset);
}

// Settings event listeners
function initializeSettings() {
  document.getElementById('crf').addEventListener('input', (e) => {
    document.getElementById('crf-value').textContent = e.target.value;
  });
  
  document.querySelectorAll('.res-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('resolution').value = btn.dataset.res;
    });
  });
  
  document.querySelectorAll('.br-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('audio-bitrate').value = btn.dataset.br;
    });
  });
}

// Preset system
function initializePresets() {
  const presets = {
    tv: { resolution: '720', crf: '28', preset: 'fast', videoCodec: 'libx264', audioCodec: 'aac', container: 'mkv', audioBitrate: '192k' },
    movie: { resolution: '1080', crf: '23', preset: 'slow', videoCodec: 'libx264', audioCodec: 'aac', container: 'mkv', audioBitrate: '192k' },
    quality: { resolution: '1080', crf: '18', preset: 'slower', videoCodec: 'libx264', audioCodec: 'aac', container: 'mkv', audioBitrate: '256k' },
    small: { resolution: '720', crf: '30', preset: 'fast', videoCodec: 'libx265', audioCodec: 'aac', container: 'mp4', audioBitrate: '128k' }
  };
  
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = presets[btn.dataset.preset];
      applyPreset(preset);
      log(`Applied ${btn.textContent.trim()} preset`, 'info');
    });
  });
}

function applyPreset(preset) {
  Object.keys(preset).forEach(key => {
    const element = document.getElementById(key);
    if (element) {
      element.value = preset[key];
      if (key === 'crf') {
        document.getElementById('crf-value').textContent = preset[key];
      }
    }
  });
}

// Select folder
async function selectFolder() {
  const result = await window.electronAPI.selectFolder();
  if (!result.canceled && result.path) {
    const recursive = confirm('Scan subfolders recursively?');
    const scanResult = await window.electronAPI.scanFolder(result.path, recursive);
    
    if (scanResult.error) {
      log(`Error scanning folder: ${scanResult.error}`, 'error');
    } else if (scanResult.files.length === 0) {
      log('No video files found in folder', 'warn');
    } else {
      // Files now come with size property from main process
      files = scanResult.files.map(file => ({ 
        path: file.path, 
        status: 'pending', 
        originalSize: file.size, 
        newSize: 0 
      }));
      updateFileList();
      log(`Found ${files.length} video files`, 'success');
    }
  }
}

// Select files
async function selectFiles() {
  const result = await window.electronAPI.selectFiles();
  if (!result.canceled && result.files) {
    // Files now come with size property from main process
    files = result.files.map(file => ({ 
      path: file.path, 
      status: 'pending', 
      originalSize: file.size, 
      newSize: 0 
    }));
    updateFileList();
    log(`Added ${files.length} files`, 'success');
  }
}

// Clear files
function clearFiles() {
  if (converting) {
    log('Cannot clear files during conversion', 'warn');
    return;
  }
  files = [];
  successCount = 0;
  failCount = 0;
  totalSpaceSaved = 0;
  updateFileList();
  log('Cleared file list', 'info');
}

// Update file list UI
function updateFileList() {
  const container = document.getElementById('file-list');
  container.innerHTML = '';
  
  if (files.length === 0) {
    container.innerHTML = '<div class="text-gray-500 text-center py-12">No files selected<br/><span class="text-sm">Click "Add Folder" or "Add Files" to begin</span></div>';
    return;
  }
  
  files.forEach((file, index) => {
    const div = document.createElement('div');
    div.className = 'file-item px-4 py-2 rounded';
    
    let statusIcon = '';
    let statusColor = '';
    
    switch (file.status) {
      case 'pending':
        statusIcon = '○';
        statusColor = 'text-gray-400';
        break;
      case 'processing':
        statusIcon = '◐';
        statusColor = 'text-blue-400';
        break;
      case 'success':
        statusIcon = '✓';
        statusColor = 'text-green-400';
        break;
      case 'error':
        statusIcon = '✗';
        statusColor = 'text-red-400';
        break;
    }
    
    const filename = file.path.split(/[\\/]/).pop();
    const originalSize = formatBytes(file.originalSize);
    const newSize = file.newSize > 0 ? formatBytes(file.newSize) : '-';
    const saved = file.newSize > 0 && file.originalSize > file.newSize 
      ? '-' + formatBytes(file.originalSize - file.newSize)
      : '-';
    const savedColor = file.newSize > 0 && file.originalSize > file.newSize ? 'text-green-400' : 'text-gray-500';
    
    div.innerHTML = `
      <div class="grid grid-cols-12 gap-2 items-center text-xs">
        <div class="col-span-1 text-center ${statusColor} text-lg">${statusIcon}</div>
        <div class="col-span-6 truncate" title="${filename}">${filename}</div>
        <div class="col-span-2 text-right text-gray-400">${originalSize}</div>
        <div class="col-span-2 text-right ${file.status === 'success' ? 'text-blue-400' : 'text-gray-500'}">${newSize}</div>
        <div class="col-span-1 text-right ${savedColor} font-mono">${saved}</div>
      </div>
    `;
    
    container.appendChild(div);
  });
  
  updateStats();
}

// Update statistics
function updateStats() {
  document.getElementById('total-files').textContent = files.length;
  document.getElementById('success-count').textContent = successCount;
  document.getElementById('fail-count').textContent = failCount;
  document.getElementById('space-saved').textContent = formatBytes(totalSpaceSaved);
}

// Get settings from UI
function getSettings() {
  return {
    container: document.getElementById('container').value,
    videoCodec: document.getElementById('videoCodec').value,
    audioCodec: document.getElementById('audioCodec').value,
    resolution: document.getElementById('resolution').value,
    crf: document.getElementById('crf').value,
    preset: document.getElementById('preset').value,
    audioBitrate: document.getElementById('audio-bitrate').value,
    trackMode: 'all', // Simplified for fresh build
    cleanFilenames: document.getElementById('clean-filenames').checked,
    outputToSubfolder: document.getElementById('output-subfolder').checked,
    replaceOriginal: document.getElementById('replace-original').checked
  };
}

// Start conversion
async function startConversion() {
  if (files.length === 0) {
    log('No files to convert', 'warn');
    return;
  }
  
  if (converting) {
    log('Conversion already in progress', 'warn');
    return;
  }
  
  // Confirm if replace original is checked
  const settings = getSettings();
  if (settings.replaceOriginal) {
    const confirmed = confirm('WARNING: This will replace your original files! Continue?');
    if (!confirmed) return;
  }
  
  converting = true;
  currentFileIndex = 0;
  successCount = 0;
  failCount = 0;
  
  document.getElementById('convert-btn').disabled = true;
  document.getElementById('stop-btn').disabled = false;
  
  log(`Starting conversion of ${files.length} files...`, 'info');
  
  // Set up progress listeners
  window.electronAPI.onConversionProgress((data) => {
    updateProgress(data.percent);
  });
  
  window.electronAPI.onConversionLog((message) => {
    log(message, 'info');
  });
  
  // Process files
  await processFiles(settings);
  
  // Cleanup
  window.electronAPI.removeAllListeners('conversion-progress');
  window.electronAPI.removeAllListeners('conversion-log');
  
  converting = false;
  document.getElementById('convert-btn').disabled = false;
  document.getElementById('stop-btn').disabled = true;
  
  log(`✓ Batch complete: ${successCount} succeeded, ${failCount} failed`, 'info');
}

// Process files sequentially
async function processFiles(settings) {
  for (let i = 0; i < files.length && converting; i++) {
    currentFileIndex = i;
    const file = files[i];
    
    file.status = 'processing';
    updateFileList();
    
    log(`Converting file ${i + 1}/${files.length}: ${file.path.split(/[\\/]/).pop()}`, 'info');
    
    const result = await window.electronAPI.convertFile(file.path, settings);
    
    if (result.error) {
      file.status = 'error';
      failCount++;
      log(`✗ Failed: ${result.error}`, 'error');
    } else {
      file.status = 'success';
      successCount++;
      
      // Use output size from main process
      if (result.outputSize) {
        file.newSize = result.outputSize;
        
        // Calculate space saved
        if (file.originalSize > file.newSize) {
          const saved = file.originalSize - file.newSize;
          totalSpaceSaved += saved;
          log(`Saved ${formatBytes(saved)}`, 'success');
        }
      }
    }
    
    updateFileList();
    updateProgress(((i + 1) / files.length) * 100);
  }
}

// Stop conversion
function stopConversion() {
  if (!converting) return;
  
  converting = false;
  log('Stopping conversion...', 'warn');
  
  document.getElementById('stop-btn').disabled = true;
}

// Update progress bar
function updateProgress(percent) {
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  
  progressBar.style.width = `${percent}%`;
  progressText.textContent = `${Math.round(percent)}%`;
}

// Logging
function log(message, type = 'info') {
  const logContainer = document.getElementById('log-container');
  const entry = document.createElement('div');
  entry.className = 'text-sm py-1';
  
  const timestamp = new Date().toLocaleTimeString();
  let color = '';
  
  switch (type) {
    case 'success':
      color = 'text-green-400';
      break;
    case 'error':
      color = 'text-red-400';
      break;
    case 'warn':
      color = 'text-yellow-400';
      break;
    default:
      color = 'text-gray-300';
  }
  
  entry.innerHTML = `<span class="text-gray-500">[${timestamp}]</span> <span class="${color}">${message}</span>`;
  
  logContainer.appendChild(entry);
  logContainer.scrollTop = logContainer.scrollHeight;
}

// Clear log
function clearLog() {
  const logContainer = document.getElementById('log-container');
  logContainer.innerHTML = '';
  log('Log cleared', 'info');
}

