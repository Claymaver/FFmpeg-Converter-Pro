const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');

let mainWindow;
let ffmpegPath = null;
let ffprobePath = null;
let userDataPath;

// Find FFmpeg in system
function findSystemFFmpeg() {
  const possiblePaths = [];
  
  if (process.platform === 'win32') {
    possiblePaths.push(
      'C:\\ffmpeg\\bin\\ffmpeg.exe',
      'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'ffmpeg', 'bin', 'ffmpeg.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'ffmpeg', 'bin', 'ffmpeg.exe')
    );
  } else if (process.platform === 'darwin') {
    possiblePaths.push(
      '/usr/local/bin/ffmpeg',
      '/opt/homebrew/bin/ffmpeg',
      '/usr/bin/ffmpeg'
    );
  } else {
    possiblePaths.push(
      '/usr/bin/ffmpeg',
      '/usr/local/bin/ffmpeg',
      '/snap/bin/ffmpeg'
    );
  }

  for (const testPath of possiblePaths) {
    if (fs.existsSync(testPath)) {
      return testPath;
    }
  }

  try {
    const command = process.platform === 'win32' ? 'where ffmpeg' : 'which ffmpeg';
    const result = execSync(command, { encoding: 'utf8' }).trim();
    if (result && fs.existsSync(result.split('\n')[0])) {
      return result.split('\n')[0];
    }
  } catch (error) {
    // Command failed
  }

  return null;
}

function findSystemFFprobe() {
  if (!ffmpegPath) return null;
  
  const ffprobeExe = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
  const ffprobePath = path.join(path.dirname(ffmpegPath), ffprobeExe);
  
  if (fs.existsSync(ffprobePath)) {
    return ffprobePath;
  }

  try {
    const command = process.platform === 'win32' ? 'where ffprobe' : 'which ffprobe';
    const result = execSync(command, { encoding: 'utf8' }).trim();
    if (result && fs.existsSync(result.split('\n')[0])) {
      return result.split('\n')[0];
    }
  } catch (error) {
    // Command failed
  }

  return null;
}

// Sanitize filename
function sanitizeFilename(filename) {
  return filename
    .replace(/[<>:"|?*\x00-\x1F]/g, '_') // Replace invalid chars
    .replace(/\s+/g, '_') // Replace spaces
    .replace(/_{2,}/g, '_') // Remove duplicate underscores
    .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
    .substring(0, 200); // Limit length
}

// Validate file path
function isValidFilePath(filePath) {
  // Check for invalid characters
  const invalidChars = /[<>"|?*\x00-\x1F]/;
  if (invalidChars.test(filePath)) {
    return { valid: false, reason: 'Contains invalid characters: < > : " | ? *' };
  }
  
  // Check path length
  if (filePath.length > 255) {
    return { valid: false, reason: `Path too long (${filePath.length} chars, max 255)` };
  }
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return { valid: false, reason: 'File does not exist' };
  }
  
  return { valid: true };
}

// Generate output filename based on naming pattern
function generateOutputFilename(inputPath, settings, format) {
  const parsedPath = path.parse(inputPath);
  const baseName = parsedPath.name;
  const ext = format || parsedPath.ext.substring(1);
  
  let newName = baseName;
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].replace(/:/g, '');
  
  switch (settings.namingPattern) {
    case 'clean':
      newName = sanitizeFilename(baseName);
      break;
      
    case 'prefix':
      newName = (settings.filenamePrefix || 'converted_') + baseName;
      break;
      
    case 'suffix':
      newName = baseName + (settings.filenameSuffix || '_converted');
      break;
      
    case 'custom':
      newName = (settings.customNamingPattern || '{name}')
        .replace('{name}', baseName)
        .replace('{date}', date)
        .replace('{time}', time)
        .replace('{format}', ext)
        .replace('{codec}', settings.videoCodec || 'unknown')
        .replace('{resolution}', settings.videoResolution || 'original');
      break;
      
    default: // 'original'
      newName = baseName;
  }
  
  // Clean if requested
  if (settings.cleanFilename) {
    newName = sanitizeFilename(newName);
  }
  
  return newName + '.' + ext;
}

// Get output path
function getOutputPath(inputPath, settings, format) {
  const parsedPath = path.parse(inputPath);
  const outputFilename = generateOutputFilename(inputPath, settings, format);
  
  let outputDir;
  
  if (settings.replaceOriginal) {
    outputDir = parsedPath.dir;
  } else if (settings.outputFolder) {
    outputDir = settings.outputFolder;
  } else {
    // Default: create "converted" subfolder
    outputDir = path.join(parsedPath.dir, 'converted');
  }
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  return path.join(outputDir, outputFilename);
}

// Build FFmpeg arguments
function buildFFmpegArgs(inputPath, outputPath, settings) {
  const args = ['-i', inputPath];
  
  // Hardware acceleration
  if (settings.hwAccel && settings.hwAccel !== '') {
    if (settings.hwAccel === 'auto') {
      args.push('-hwaccel', 'auto');
    } else if (settings.hwAccel === 'nvenc') {
      args.push('-hwaccel', 'cuda');
    } else if (settings.hwAccel === 'qsv') {
      args.push('-hwaccel', 'qsv');
    } else if (settings.hwAccel === 'amf') {
      args.push('-hwaccel', 'dxva2');
    } else if (settings.hwAccel === 'videotoolbox') {
      args.push('-hwaccel', 'videotoolbox');
    }
  }
  
  // Thread count
  if (settings.threadCount && settings.threadCount !== '') {
    args.push('-threads', settings.threadCount);
  }
  
  // === VIDEO SETTINGS ===
  if (settings.videoCodec && settings.videoCodec !== 'none') {
    args.push('-c:v', settings.videoCodec);
    
    if (settings.videoCodec !== 'copy') {
      // Quality/Bitrate
      if (settings.videoQualityMode === 'crf' && settings.videoCrf) {
        args.push('-crf', settings.videoCrf);
      } else if (settings.videoQualityMode === 'bitrate' && settings.videoBitrate) {
        args.push('-b:v', settings.videoBitrate + 'k');
      }
      
      // Preset
      if (settings.videoPreset && ['libx264', 'libx265'].includes(settings.videoCodec)) {
        args.push('-preset', settings.videoPreset);
      }
      
      // Resolution
      if (settings.videoResolution && settings.videoResolution !== '') {
        if (settings.videoResolution === 'custom' && settings.customResolution) {
          args.push('-s', settings.customResolution);
        } else {
          args.push('-s', settings.videoResolution);
        }
      }
      
      // FPS
      if (settings.videoFps && settings.videoFps !== '') {
        args.push('-r', settings.videoFps);
      }
      
      // Pixel format
      if (settings.videoPixfmt && settings.videoPixfmt !== '') {
        args.push('-pix_fmt', settings.videoPixfmt);
      }
      
      // Aspect ratio
      if (settings.videoAspect && settings.videoAspect !== '') {
        args.push('-aspect', settings.videoAspect);
      }
      
      // GOP size
      if (settings.videoGop && settings.videoGop !== '') {
        args.push('-g', settings.videoGop);
      }
      
      // B-frames
      if (settings.videoBframes && settings.videoBframes !== '') {
        args.push('-bf', settings.videoBframes);
      }
      
      // Video filters
      if (settings.videoFilters && settings.videoFilters !== '') {
        args.push('-vf', settings.videoFilters);
      }
    }
  } else {
    args.push('-vn'); // No video
  }
  
  // === AUDIO SETTINGS ===
  if (settings.audioCodec && settings.audioCodec !== 'none') {
    args.push('-c:a', settings.audioCodec);
    
    if (settings.audioCodec !== 'copy') {
      // Bitrate
      if (settings.audioBitrate && settings.audioBitrate !== '') {
        args.push('-b:a', settings.audioBitrate + 'k');
      }
      
      // Sample rate
      if (settings.audioSamplerate && settings.audioSamplerate !== '') {
        args.push('-ar', settings.audioSamplerate);
      }
      
      // Channels
      if (settings.audioChannels && settings.audioChannels !== '') {
        args.push('-ac', settings.audioChannels);
      }
      
      // Quality
      if (settings.audioQuality && settings.audioQuality !== '') {
        args.push('-q:a', settings.audioQuality);
      }
      
      // Volume
      if (settings.audioVolume && settings.audioVolume !== '100') {
        const volumeFilter = `volume=${parseFloat(settings.audioVolume) / 100}`;
        if (settings.audioFilters) {
          args.push('-af', `${volumeFilter},${settings.audioFilters}`);
        } else {
          args.push('-af', volumeFilter);
        }
      } else if (settings.audioFilters && settings.audioFilters !== '') {
        args.push('-af', settings.audioFilters);
      }
      
      // Normalization
      if (settings.audioNormalize && settings.audioNormalize !== '') {
        const currentAf = args.indexOf('-af');
        if (currentAf !== -1) {
          args[currentAf + 1] += ',' + settings.audioNormalize;
        } else {
          args.push('-af', settings.audioNormalize);
        }
      }
    }
    
    // Audio stream selection
    if (settings.audioStream && settings.audioStream !== '') {
      args.push('-map', `0:a:${settings.audioStream}`);
    }
  } else {
    args.push('-an'); // No audio
  }
  
  // === SUBTITLE SETTINGS ===
  if (settings.subtitleMode === 'copy') {
    args.push('-c:s', 'copy');
  } else if (settings.subtitleMode === 'none') {
    args.push('-sn');
  } else if (settings.subtitleMode === 'select') {
    if (settings.subtitleStream && settings.subtitleStream !== '') {
      args.push('-map', `0:s:${settings.subtitleStream}`);
    }
    if (settings.subtitleLanguage && settings.subtitleLanguage !== '') {
      args.push('-metadata:s:s:0', `language=${settings.subtitleLanguage}`);
    }
    if (settings.subtitleForced === 'yes') {
      args.push('-disposition:s:0', 'forced');
    }
  } else if (settings.subtitleMode === 'burn' && settings.burnSubtitleFile) {
    // Burn subtitles into video
    const subtitlePath = settings.burnSubtitleFile.replace(/\\/g, '/').replace(/:/g, '\\:');
    let subtitleFilter = `subtitles='${subtitlePath}'`;
    
    if (settings.burnSubtitleStyle) {
      subtitleFilter += `:force_style='${settings.burnSubtitleStyle}'`;
    }
    
    const vfIndex = args.indexOf('-vf');
    if (vfIndex !== -1) {
      args[vfIndex + 1] += ',' + subtitleFilter;
    } else {
      args.push('-vf', subtitleFilter);
    }
    args.push('-sn'); // Remove subtitle streams
  }
  
  // External subtitles
  if (settings.externalSubtitles && settings.externalSubtitles.length > 0) {
    settings.externalSubtitles.forEach((sub, index) => {
      args.push('-i', sub.file);
      args.push('-map', `${index + 1}:0`);
      if (sub.language) {
        args.push(`-metadata:s:s:${index}`, `language=${sub.language}`);
      }
      if (sub.title) {
        args.push(`-metadata:s:s:${index}`, `title=${sub.title}`);
      }
    });
  }
  
  // === METADATA SETTINGS ===
  if (settings.metadataMode === 'strip') {
    args.push('-map_metadata', '-1');
  } else if (settings.metadataMode === 'custom') {
    if (settings.metadataTitle) {
      args.push('-metadata', `title=${settings.metadataTitle}`);
    }
    if (settings.metadataArtist) {
      args.push('-metadata', `artist=${settings.metadataArtist}`);
    }
    if (settings.metadataCopyright) {
      args.push('-metadata', `copyright=${settings.metadataCopyright}`);
    }
    if (settings.metadataComment) {
      args.push('-metadata', `comment=${settings.metadataComment}`);
    }
  }
  // 'copy' mode is default - no args needed
  
  // === CUSTOM ARGUMENTS ===
  if (settings.customVideoArgs && settings.customVideoArgs.trim() !== '') {
    args.push(...settings.customVideoArgs.trim().split(/\s+/));
  }
  
  if (settings.customAudioArgs && settings.customAudioArgs.trim() !== '') {
    args.push(...settings.customAudioArgs.trim().split(/\s+/));
  }
  
  if (settings.globalCustomArgs && settings.globalCustomArgs.trim() !== '') {
    args.push(...settings.globalCustomArgs.trim().split(/\s+/));
  }
  
  // === OVERWRITE MODE ===
  if (settings.overwriteMode === 'yes') {
    args.push('-y');
  } else if (settings.overwriteMode === 'no') {
    args.push('-n');
  }
  // 'ask' mode is handled before calling FFmpeg
  
  // Progress
  args.push('-progress', 'pipe:1');
  
  // Output
  args.push(outputPath);
  
  return args;
}

// Parse FFmpeg progress output
function parseProgress(data, duration) {
  const lines = data.toString().split('\n');
  const progress = {};
  
  lines.forEach(line => {
    const parts = line.split('=');
    if (parts.length === 2) {
      progress[parts[0].trim()] = parts[1].trim();
    }
  });
  
  if (progress.out_time_ms && duration) {
    const currentTime = parseInt(progress.out_time_ms) / 1000000; // Convert to seconds
    const percent = Math.min((currentTime / duration) * 100, 100);
    
    return {
      percent: percent,
      fps: progress.fps || '0',
      speed: progress.speed || '0x',
      time: currentTime,
      remaining: duration - currentTime
    };
  }
  
  return null;
}

// Get video duration using ffprobe
async function getVideoDuration(filePath) {
  if (!ffprobePath) return null;
  
  return new Promise((resolve) => {
    const args = [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ];
    
    const process = spawn(ffprobePath, args);
    let output = '';
    
    process.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    process.on('close', () => {
      const duration = parseFloat(output.trim());
      resolve(isNaN(duration) ? null : duration);
    });
    
    process.on('error', () => {
      resolve(null);
    });
  });
}

// Convert single file
async function convertFile(inputPath, settings, fileIndex) {
  return new Promise(async (resolve, reject) => {
    try {
      // Validate input file
      const validation = isValidFilePath(inputPath);
      if (!validation.valid) {
        return reject(new Error(`Invalid file: ${validation.reason}`));
      }
      
      // Get output path
      const outputPath = getOutputPath(inputPath, settings, settings.videoFormat);
      
      // Check if output exists and handle based on overwrite mode
      if (fs.existsSync(outputPath)) {
        if (settings.overwriteMode === 'no') {
          return resolve({
            success: true,
            output: outputPath,
            skipped: true,
            message: 'File already exists (skipped)'
          });
        } else if (settings.overwriteMode === 'ask') {
          // In real app, show dialog - for now, skip
          return resolve({
            success: true,
            output: outputPath,
            skipped: true,
            message: 'File already exists (skipped - ask mode)'
          });
        }
      }
      
      // Get video duration for progress calculation
      const duration = await getVideoDuration(inputPath);
      
      // Build FFmpeg arguments
      const args = buildFFmpegArgs(inputPath, outputPath, settings);
      
      console.log('FFmpeg command:', ffmpegPath, args.join(' '));
      
      // Spawn FFmpeg process
      const ffmpegProcess = spawn(ffmpegPath, args);
      
      let errorOutput = '';
      
      // Handle progress
      ffmpegProcess.stdout.on('data', (data) => {
        if (duration && mainWindow) {
          const progress = parseProgress(data, duration);
          if (progress) {
            const eta = progress.remaining > 0 
              ? `${Math.floor(progress.remaining / 60)}m ${Math.floor(progress.remaining % 60)}s`
              : 'finishing...';
            
            mainWindow.webContents.send('conversion-progress', {
              fileIndex,
              progress: progress.percent,
              speed: `${progress.fps} fps`,
              eta: eta
            });
          }
        }
      });
      
      ffmpegProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        // Also parse progress from stderr (FFmpeg writes progress there too)
        if (duration && mainWindow) {
          const progress = parseProgress(data, duration);
          if (progress) {
            const eta = progress.remaining > 0 
              ? `${Math.floor(progress.remaining / 60)}m ${Math.floor(progress.remaining % 60)}s`
              : 'finishing...';
            
            mainWindow.webContents.send('conversion-progress', {
              fileIndex,
              progress: progress.percent,
              speed: `${progress.fps} fps`,
              eta: eta
            });
          }
        }
      });
      
      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          // Success
          if (settings.replaceOriginal && !settings.replaceOriginal) {
            // If not replacing, we're done
            resolve({
              success: true,
              output: outputPath
            });
          } else if (settings.replaceOriginal) {
            // Replace original file
            try {
              fs.unlinkSync(inputPath);
              fs.renameSync(outputPath, inputPath);
              resolve({
                success: true,
                output: inputPath,
                replaced: true
              });
            } catch (err) {
              reject(new Error(`Conversion succeeded but failed to replace original: ${err.message}`));
            }
          } else {
            resolve({
              success: true,
              output: outputPath
            });
          }
        } else {
          // Extract meaningful error from FFmpeg output
          let errorMessage = 'Conversion failed';
          
          // Try to find specific error messages
          if (errorOutput.includes('Invalid data found')) {
            errorMessage = 'Invalid or corrupted input file';
          } else if (errorOutput.includes('No such file or directory')) {
            errorMessage = 'File not found or path contains invalid characters';
          } else if (errorOutput.includes('Permission denied')) {
            errorMessage = 'Permission denied - check file/folder permissions';
          } else if (errorOutput.includes('Encoder') && errorOutput.includes('not found')) {
            errorMessage = 'Codec not available in this FFmpeg build';
          } else if (errorOutput.includes('Unknown encoder')) {
            errorMessage = 'Unknown or unsupported codec';
          } else {
            // Try to extract the actual error line
            const errorLines = errorOutput.split('\n').filter(line => 
              line.includes('Error') || line.includes('error') || line.includes('failed')
            );
            if (errorLines.length > 0) {
              errorMessage = errorLines[errorLines.length - 1].trim();
            }
          }
          
          reject(new Error(errorMessage));
        }
      });
      
      ffmpegProcess.on('error', (err) => {
        reject(new Error(`Failed to start FFmpeg: ${err.message}`));
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

// Create main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    frame: false,  // Remove default frame
    titleBarStyle: 'hidden',  // Hide title bar on macOS
    trafficLightPosition: { x: 15, y: 10 },  // macOS traffic lights position
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: true  // Ensure DevTools are available
    },
    backgroundColor: '#1e1e1e',  // Match VS Code theme
    icon: path.join(__dirname, '..', 'build', 'icon.png'),  // Adjusted for src/ folder
    minWidth: 900,
    minHeight: 600
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  
  // DevTools can be opened with F12 keyboard shortcut
  // Uncomment the line below if you need DevTools to open automatically:
  // mainWindow.webContents.openDevTools();
  
  // Add keyboard shortcut for DevTools (F12)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
    }
  });

  // Log any console errors from renderer
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer ${level}] ${message} (${sourceId}:${line})`);
  });

  // Catch page load errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load page:', errorCode, errorDescription);
  });
}

// App ready
app.whenReady().then(() => {
  // Set user data path
  userDataPath = app.getPath('userData');
  
  // Find FFmpeg
  ffmpegPath = findSystemFFmpeg();
  ffprobePath = findSystemFFprobe();
  
  if (ffmpegPath) {
    console.log('Found FFmpeg at:', ffmpegPath);
  } else {
    console.error('FFmpeg not found!');
  }
  
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// === IPC HANDLERS ===

// Select files
ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelection'],
    filters: [
      { name: 'Video Files', extensions: ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg'] },
      { name: 'Audio Files', extensions: ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'wma'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  return result.canceled ? [] : result.filePaths;
});

// Select folder
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  
  if (result.canceled) return [];
  
  // Get all video/audio files in the folder
  const folderPath = result.filePaths[0];
  const files = [];
  
  function scanDirectory(dir) {
    const items = fs.readdirSync(dir);
    
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else {
        const ext = path.extname(item).toLowerCase();
        if (['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v', 
             '.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.mpg', '.mpeg'].includes(ext)) {
          files.push(fullPath);
        }
      }
    });
  }
  
  scanDirectory(folderPath);
  return files;
});

// Select single file
ipcMain.handle('select-file', async (event, title) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: title || 'Select File',
    properties: ['openFile'],
    filters: [
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  return result.canceled ? null : result.filePaths[0];
});

// Convert file
ipcMain.handle('convert-file', async (event, inputPath, settings, fileIndex) => {
  try {
    const result = await convertFile(inputPath, settings, fileIndex);
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Check FFmpeg status
ipcMain.handle('check-ffmpeg-status', async () => {
  if (!ffmpegPath) {
    return {
      available: false,
      version: null
    };
  }
  
  try {
    const version = execSync(`"${ffmpegPath}" -version`, { encoding: 'utf8' });
    const versionMatch = version.match(/ffmpeg version ([^\s]+)/);
    
    return {
      available: true,
      version: versionMatch ? versionMatch[1] : 'Unknown'
    };
  } catch (error) {
    return {
      available: false,
      version: null
    };
  }
});

// Test FFmpeg
ipcMain.handle('test-ffmpeg', async (event, customPath) => {
  const testPath = customPath || ffmpegPath;
  
  if (!testPath) {
    return {
      success: false,
      error: 'No FFmpeg path specified'
    };
  }
  
  try {
    const version = execSync(`"${testPath}" -version`, { encoding: 'utf8' });
    const versionMatch = version.match(/ffmpeg version ([^\s]+)/);
    
    if (customPath) {
      ffmpegPath = customPath;
      ffprobePath = findSystemFFprobe();
    }
    
    return {
      success: true,
      version: versionMatch ? versionMatch[1] : 'Unknown'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Save presets
ipcMain.handle('save-presets', async (event, presets) => {
  try {
    const presetsPath = path.join(userDataPath, 'presets.json');
    fs.writeFileSync(presetsPath, JSON.stringify(presets, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Load presets
ipcMain.handle('load-presets', async () => {
  try {
    const presetsPath = path.join(userDataPath, 'presets.json');
    if (fs.existsSync(presetsPath)) {
      const data = fs.readFileSync(presetsPath, 'utf8');
      return JSON.parse(data);
    }
    return {};
  } catch (error) {
    return {};
  }
});

// Save settings
ipcMain.handle('save-settings', async (event, settings) => {
  try {
    const settingsPath = path.join(userDataPath, 'settings.json');
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Load settings
ipcMain.handle('load-settings', async () => {
  try {
    const settingsPath = path.join(userDataPath, 'settings.json');
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      return JSON.parse(data);
    }
    return {};
  } catch (error) {
    return {};
  }
});

// Open external URL
ipcMain.handle('open-external', async (event, url) => {
  const { shell } = require('electron');
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Window controls
ipcMain.handle('window-minimize', () => {
  console.log('Window minimize requested');
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle('window-maximize', () => {
  console.log('Window maximize requested');
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window-close', () => {
  console.log('Window close requested');
  if (mainWindow) {
    mainWindow.close();
  }
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});
