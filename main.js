// ============================================================================
//  main.js
// ============================================================================

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

let mainWindow;
let ffmpegInstalled = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
  
  // Check FFmpeg on startup
  checkFFmpeg();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Check if FFmpeg is installed
async function checkFFmpeg() {
  try {
    await execAsync('ffmpeg -version');
    ffmpegInstalled = true;
    mainWindow.webContents.send('ffmpeg-status', { installed: true });
  } catch (error) {
    ffmpegInstalled = false;
    mainWindow.webContents.send('ffmpeg-status', { installed: false });
  }
}

// Install FFmpeg using winget
ipcMain.handle('install-ffmpeg', async () => {
  const platform = process.platform;
  
  try {
    if (platform === 'win32') {
      // Windows - use winget
      mainWindow.webContents.send('install-progress', 'Checking winget...');
      
      try {
        await execAsync('winget --version');
      } catch (error) {
        return {
          success: false,
          error: 'Winget not found. Please install FFmpeg manually from https://ffmpeg.org'
        };
      }
      
      mainWindow.webContents.send('install-progress', 'Installing FFmpeg via winget...');
      
      await execAsync('winget install --id=Gyan.FFmpeg.Essentials -e --accept-source-agreements --accept-package-agreements');
      
    } else if (platform === 'darwin') {
      // macOS - use Homebrew
      mainWindow.webContents.send('install-progress', 'Checking Homebrew...');
      
      try {
        await execAsync('brew --version');
      } catch (error) {
        return {
          success: false,
          error: 'Homebrew not found. Please install Homebrew first from https://brew.sh or install FFmpeg manually.'
        };
      }
      
      mainWindow.webContents.send('install-progress', 'Installing FFmpeg via Homebrew...');
      
      await execAsync('brew install ffmpeg');
      
    } else if (platform === 'linux') {
      // Linux - try apt, then snap as fallback
      mainWindow.webContents.send('install-progress', 'Checking package manager...');
      
      try {
        // Try apt first (Debian/Ubuntu)
        await execAsync('apt --version');
        mainWindow.webContents.send('install-progress', 'Installing FFmpeg via apt...');
        mainWindow.webContents.send('install-progress', 'This may require administrator password...');
        
        // Using pkexec for GUI password prompt
        await execAsync('pkexec apt install -y ffmpeg');
        
      } catch (aptError) {
        try {
          // Try snap as fallback
          await execAsync('snap --version');
          mainWindow.webContents.send('install-progress', 'Installing FFmpeg via snap...');
          await execAsync('pkexec snap install ffmpeg');
          
        } catch (snapError) {
          return {
            success: false,
            error: 'Could not find apt or snap. Please install FFmpeg manually using your package manager.'
          };
        }
      }
      
    } else {
      return {
        success: false,
        error: 'Unsupported platform. Please install FFmpeg manually from https://ffmpeg.org'
      };
    }
    
    mainWindow.webContents.send('install-progress', 'Verifying installation...');
    
    // Wait a moment for installation to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if FFmpeg is now available
    try {
      await execAsync('ffmpeg -version');
      ffmpegInstalled = true;
      mainWindow.webContents.send('ffmpeg-status', { installed: true });
      return { success: true };
    } catch (verifyError) {
      return {
        success: false,
        error: 'FFmpeg installed but not found in PATH. Please restart the application or add FFmpeg to PATH manually.'
      };
    }
    
  } catch (error) {
    let errorMsg = `Installation failed: ${error.message}.`;
    
    if (platform === 'linux' || platform === 'darwin') {
      errorMsg += ' You may need administrator privileges.';
    } else if (platform === 'win32') {
      errorMsg += ' You may need to run as administrator.';
    }
    
    return {
      success: false,
      error: errorMsg
    };
  }
});

// Check FFmpeg status
ipcMain.handle('check-ffmpeg', async () => {
  await checkFFmpeg();
  return ffmpegInstalled;
});

// Replace original file with converted file
ipcMain.handle('replace-original', async (event, originalPath, convertedPath) => {
  try {
    // Delete original
    fs.unlinkSync(originalPath);
    
    // Move converted file to original location
    const originalDir = path.dirname(originalPath);
    const convertedFileName = path.basename(convertedPath);
    const newPath = path.join(originalDir, convertedFileName);
    
    fs.renameSync(convertedPath, newPath);
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Select folder
ipcMain.handle('select-folder', async () => {
  if (!ffmpegInstalled) {
    dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'FFmpeg Required',
      message: 'Please install FFmpeg before selecting files.',
      buttons: ['OK']
    });
    return null;
  }
  
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  
  if (!result.canceled) {
    return result.filePaths[0];
  }
  return null;
});

// Select single file
ipcMain.handle('select-file', async () => {
  if (!ffmpegInstalled) {
    dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'FFmpeg Required',
      message: 'Please install FFmpeg before selecting files.',
      buttons: ['OK']
    });
    return null;
  }
  
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Video Files', extensions: ['mp4', 'mkv', 'avi', 'mov', 'flv', 'wmv', 'webm', 'm4v', 'mpg', 'mpeg'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Get video files in folder
ipcMain.handle('get-video-files', async (event, folderPath) => {
  const extensions = ['.mp4', '.mkv', '.avi', '.mov', '.flv', '.wmv', '.webm', '.m4v', '.mpg', '.mpeg'];
  const files = fs.readdirSync(folderPath);
  
  const videoFiles = files
    .filter(file => extensions.includes(path.extname(file).toLowerCase()))
    .map(file => {
      const fullPath = path.join(folderPath, file);
      const stats = fs.statSync(fullPath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);
      
      return {
        name: file,
        path: fullPath,
        size: sizeMB,
        cleanName: cleanFileName(file)
      };
    });
  
  return videoFiles;
});

// Get single video file info
ipcMain.handle('get-single-file', async (event, filePath) => {
  const stats = fs.statSync(filePath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);
  const fileName = path.basename(filePath);
  
  return {
    name: fileName,
    path: filePath,
    size: sizeMB,
    cleanName: cleanFileName(fileName)
  };
});

// Clean filename
function cleanFileName(filename) {
  let name = path.parse(filename).name;
  
  // Remove brackets
  name = name.replace(/\[.*?\]/g, '');
  
  // Remove quality tags
  const tags = [
    'Bluray-1080p', 'BluRay-1080p', 'Bluray-720p', 'BluRay-720p',
    'WEB-DL', 'WEBDL', 'Web-DL', '.WEB-DL', '.WEBDL', ' WEB-DL',
    'WEBRip', 'WEBRIP', '.WEBRip', ' WEBRip',
    'DVDRip', 'BRRip', 'HDTV',
    ' 1080p', ' 720p', ' 480p', '1080p', '720p', '480p'
  ];
  
  tags.forEach(tag => {
    name = name.replace(new RegExp(tag, 'gi'), '');
  });
  
  // Remove apostrophes
  name = name.replace(/'/g, '');
  
  // Trim spaces and dashes
  name = name.trim().replace(/\s*-\s*$/g, '').replace(/^-\s*/g, '');
  
  return name + '.mkv';
}

// Convert single file
ipcMain.handle('convert-file', async (event, fileInfo, settings) => {
  const outputDir = path.join(path.dirname(fileInfo.path), 'converted');
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }
  
  const outputPath = path.join(outputDir, fileInfo.cleanName);
  
  return new Promise((resolve, reject) => {
    let outputOptions = [
      `-c:v ${settings.codec}`,
      `-crf ${settings.crf}`,
      `-preset ${settings.preset}`,
      `-vf scale='min(iw,${settings.width})':'min(ih,${settings.height})':force_original_aspect_ratio=decrease`,
      '-c:s copy',
      '-map 0'
    ];
    
    // Handle audio codec
    if (settings.audioCodec === 'copy') {
      outputOptions.push('-c:a copy');
    } else {
      outputOptions.push(`-c:a ${settings.audioCodec}`);
      outputOptions.push(`-b:a ${settings.audioBitrate}k`);
    }
    
    const command = ffmpeg(fileInfo.path)
      .outputOptions(outputOptions)
      .output(outputPath);
    
    command.on('start', (cmd) => {
      console.log('FFmpeg command:', cmd);
    });
    
    command.on('progress', (progress) => {
      mainWindow.webContents.send('conversion-progress', {
        file: fileInfo.name,
        percent: progress.percent || 0,
        timemark: progress.timemark
      });
    });
    
    command.on('end', () => {
      const stats = fs.statSync(outputPath);
      const outputSizeMB = (stats.size / (1024 * 1024)).toFixed(1);
      const saved = (fileInfo.size - outputSizeMB).toFixed(1);
      
      resolve({
        success: true,
        inputSize: fileInfo.size,
        outputSize: outputSizeMB,
        saved: saved,
        outputPath: outputPath
      });
    });
    
    command.on('error', (err) => {
      reject({ success: false, error: err.message });
    });
    
    command.run();
  });
});