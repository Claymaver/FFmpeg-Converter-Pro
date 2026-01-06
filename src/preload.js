const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File selection
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectFiles: () => ipcRenderer.invoke('select-files'),
  scanFolder: (path, recursive) => ipcRenderer.invoke('scan-folder', path, recursive),
  
  // FFmpeg operations
  checkFFmpeg: () => ipcRenderer.invoke('check-ffmpeg'),
  probeFile: (filePath) => ipcRenderer.invoke('probe-file', filePath),
  convertFile: (filePath, settings) => ipcRenderer.invoke('convert-file', filePath, settings),
  
  // Dialogs
  showError: (message) => ipcRenderer.invoke('show-error', message),
  showInfo: (title, message) => ipcRenderer.invoke('show-info', title, message),
  
  // Event listeners
  onConversionProgress: (callback) => {
    ipcRenderer.on('conversion-progress', (event, data) => callback(data));
  },
  
  onConversionLog: (callback) => {
    ipcRenderer.on('conversion-log', (event, message) => callback(message));
  },
  
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

console.log('Preload script loaded successfully');
