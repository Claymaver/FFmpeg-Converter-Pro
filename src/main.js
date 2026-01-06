const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

// Auto-install FFmpeg and FFprobe
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

console.log('FFmpeg path:', ffmpegPath);
console.log('FFprobe path:', ffprobePath);

let mainWindow;
let isConverting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    backgroundColor: '#1e1e1e',
    show: false
  });

  mainWindow.loadFile('src/index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ============================================
// IPC HANDLERS
// ============================================

// Select folder
ipcMain.handle('select-folder', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    return result.canceled ? { canceled: true } : { canceled: false, path: result.filePaths[0] };
  } catch (error) {
    console.error('Select folder error:', error);
    return { error: error.message };
  }
});

// Select files
ipcMain.handle('select-files', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Video Files', extensions: ['mp4', 'mkv', 'avi', 'mov', 'flv', 'wmv', 'webm', 'm4v', 'mpg', 'mpeg'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (result.canceled) {
      return { canceled: true };
    }
    
    // Get file sizes
    const filesWithSizes = result.filePaths.map(filePath => {
      try {
        const stat = fs.statSync(filePath);
        return { path: filePath, size: stat.size };
      } catch (error) {
        return { path: filePath, size: 0 };
      }
    });
    
    return { canceled: false, files: filesWithSizes };
  } catch (error) {
    console.error('Select files error:', error);
    return { error: error.message };
  }
});

// Scan folder for videos
ipcMain.handle('scan-folder', async (event, folderPath, recursive) => {
  try {
    const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.flv', '.wmv', '.webm', '.m4v', '.mpg', '.mpeg'];
    const files = [];

    function scanDir(dir) {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && recursive) {
          scanDir(fullPath);
        } else if (stat.isFile()) {
          const ext = path.extname(item).toLowerCase();
          if (videoExtensions.includes(ext)) {
            files.push({ path: fullPath, size: stat.size });
          }
        }
      }
    }

    scanDir(folderPath);
    return { files };
  } catch (error) {
    console.error('Scan folder error:', error);
    return { error: error.message };
  }
});

// Check FFmpeg
ipcMain.handle('check-ffmpeg', async () => {
  return {
    ffmpegPath,
    ffprobePath,
    available: fs.existsSync(ffmpegPath) && fs.existsSync(ffprobePath)
  };
});

// Probe file for track info
ipcMain.handle('probe-file', async (event, filePath) => {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        resolve({ error: err.message });
      } else {
        resolve({ metadata });
      }
    });
  });
});

// Convert file
ipcMain.handle('convert-file', async (event, filePath, settings) => {
  if (isConverting) {
    return { error: 'Conversion already in progress' };
  }

  return new Promise((resolve) => {
    isConverting = true;
    
    try {
      const inputDir = path.dirname(filePath);
      const inputName = path.basename(filePath, path.extname(filePath));
      const outputDir = settings.outputToSubfolder 
        ? path.join(inputDir, 'converted')
        : inputDir;
      
      // Create output directory if needed
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Clean filename if requested
      let outputName = inputName;
      if (settings.cleanFilenames) {
        outputName = outputName
          .replace(/\[.*?\]/g, '')
          .replace(/\(.*?\)/g, '')
          .replace(/\d{3,4}p/gi, '')
          .replace(/[hx]\.?26[45]/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
      }

      const outputPath = path.join(outputDir, `${outputName}.${settings.container}`);

      // Build FFmpeg command
      let command = ffmpeg(filePath);

      // Video codec
      if (settings.videoCodec === 'copy') {
        command = command.videoCodec('copy');
      } else {
        command = command
          .videoCodec(settings.videoCodec)
          .addOption('-crf', settings.crf)
          .addOption('-preset', settings.preset);

        if (settings.resolution && settings.resolution !== 'original') {
          command = command.size(`?x${settings.resolution}`);
        }
      }

      // Audio codec
      if (settings.audioCodec === 'copy') {
        command = command.audioCodec('copy');
      } else {
        command = command
          .audioCodec(settings.audioCodec)
          .audioBitrate(settings.audioBitrate);
      }

      // Track mapping
      if (settings.trackMode === 'all') {
        command = command.addOption('-map', '0');
      } else if (settings.trackMode === 'language' && settings.languages) {
        command = command.addOption('-map', '0:v');
        settings.languages.forEach(lang => {
          command = command.addOption('-map', `0:a:m:language:${lang}?`);
          command = command.addOption('-map', `0:s:m:language:${lang}?`);
        });
      } else if (settings.trackMode === 'custom' && settings.customTracks) {
        settings.customTracks.forEach(track => {
          command = command.addOption('-map', track);
        });
      }

      // Execute conversion
      command
        .on('start', (commandLine) => {
          mainWindow.webContents.send('conversion-log', `Starting: ${commandLine}`);
        })
        .on('progress', (progress) => {
          mainWindow.webContents.send('conversion-progress', {
            percent: progress.percent || 0,
            currentFps: progress.currentFps,
            currentKbps: progress.currentKbps,
            timemark: progress.timemark
          });
        })
        .on('end', () => {
          mainWindow.webContents.send('conversion-log', `✓ Completed: ${outputPath}`);
          
          // Get output file size
          let outputSize = 0;
          try {
            const outputStats = fs.statSync(outputPath);
            outputSize = outputStats.size;
          } catch (err) {
            // Ignore if can't get size
          }
          
          // Replace original if requested
          if (settings.replaceOriginal) {
            try {
              fs.unlinkSync(filePath);
              fs.renameSync(outputPath, filePath.replace(path.extname(filePath), `.${settings.container}`));
              mainWindow.webContents.send('conversion-log', '✓ Replaced original');
            } catch (err) {
              mainWindow.webContents.send('conversion-log', `⚠ Could not replace original: ${err.message}`);
            }
          }
          
          isConverting = false;
          resolve({ success: true, outputPath, outputSize });
        })
        .on('error', (err) => {
          mainWindow.webContents.send('conversion-log', `✗ Error: ${err.message}`);
          isConverting = false;
          resolve({ error: err.message });
        })
        .save(outputPath);

    } catch (error) {
      isConverting = false;
      resolve({ error: error.message });
    }
  });
});

// Show error dialog
ipcMain.handle('show-error', async (event, message) => {
  await dialog.showMessageBox(mainWindow, {
    type: 'error',
    title: 'Error',
    message: message
  });
});

// Show info dialog
ipcMain.handle('show-info', async (event, title, message) => {
  await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: title,
    message: message
  });
});
