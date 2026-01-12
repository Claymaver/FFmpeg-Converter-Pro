const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File selection
  selectFiles: () => ipcRenderer.invoke('select-files'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectFile: (title) => ipcRenderer.invoke('select-file', title),
  
  // Conversion
  convertFile: (inputPath, settings, fileIndex) => ipcRenderer.invoke('convert-file', inputPath, settings, fileIndex),
  onConversionProgress: (callback) => ipcRenderer.on('conversion-progress', (event, data) => callback(data)),
  
  // FFmpeg
  checkFFmpegStatus: () => ipcRenderer.invoke('check-ffmpeg-status'),
  testFFmpeg: (customPath) => ipcRenderer.invoke('test-ffmpeg', customPath),
  
  // Presets
  savePresets: (presets) => ipcRenderer.invoke('save-presets', presets),
  loadPresets: () => ipcRenderer.invoke('load-presets'),
  
  // Settings
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  
  // External links
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // Window controls
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized')
});
