const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectFiles: () => ipcRenderer.invoke('select-files'),
  getVideoFiles: (folder) => ipcRenderer.invoke('get-video-files', folder),
  getFileInfo: (filePaths) => ipcRenderer.invoke('get-file-info', filePaths),
  convertFile: (fileInfo, settings) => ipcRenderer.invoke('convert-file', fileInfo, settings),
  replaceFile: (originalPath, convertedPath) => ipcRenderer.invoke('replace-file', originalPath, convertedPath),
  onProgress: (callback) => ipcRenderer.on('conversion-progress', (event, data) => callback(data)),
  checkFFmpeg: () => ipcRenderer.invoke('check-ffmpeg'),
  installFFmpeg: () => ipcRenderer.invoke('install-ffmpeg'),
  onFFmpegStatus: (callback) => ipcRenderer.on('ffmpeg-status', (event, data) => callback(data)),
  onInstallProgress: (callback) => ipcRenderer.on('install-progress', (event, message) => callback(message))
});