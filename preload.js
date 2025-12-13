// ============================================================================
// preload.js
// ============================================================================

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectFile: () => ipcRenderer.invoke('select-file'),
  getVideoFiles: (folder) => ipcRenderer.invoke('get-video-files', folder),
  getSingleFile: (filePath) => ipcRenderer.invoke('get-single-file', filePath),
  convertFile: (fileInfo, settings) => ipcRenderer.invoke('convert-file', fileInfo, settings),
  onProgress: (callback) => ipcRenderer.on('conversion-progress', (event, data) => callback(data)),
  checkFFmpeg: () => ipcRenderer.invoke('check-ffmpeg'),
  installFFmpeg: () => ipcRenderer.invoke('install-ffmpeg'),
  onFFmpegStatus: (callback) => ipcRenderer.on('ffmpeg-status', (event, data) => callback(data)),
  onInstallProgress: (callback) => ipcRenderer.on('install-progress', (event, message) => callback(message)),
  replaceOriginal: (originalPath, convertedPath) => ipcRenderer.invoke('replace-original', originalPath, convertedPath)
});