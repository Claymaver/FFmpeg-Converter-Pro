const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');

let mainWindow;
let ffmpegPath = null;
let ffprobePath = null;
let userDataPath;
let activeFFmpegProcess = null;

// ============================================================
// FFmpeg Discovery
// ============================================================

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
  const probePath = path.join(path.dirname(ffmpegPath), ffprobeExe);

  if (fs.existsSync(probePath)) {
    return probePath;
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

// ============================================================
// Filename & Path Helpers
// ============================================================

function sanitizeFilename(filename, aggressiveClean = false) {
  let cleaned = filename
    .replace(/[<>:"|?*\x00-\x1F]/g, '_');  // Only replace truly invalid chars

  if (aggressiveClean) {
    cleaned = cleaned
      .replace(/\s+/g, '_')       // Spaces to underscores (only when requested)
      .replace(/_{2,}/g, '_');     // Collapse multiple underscores
  }

  return cleaned
    .replace(/^_+|_+$/g, '')      // Trim leading/trailing underscores
    .substring(0, 240);           // Keep within filesystem limits
}

function isValidFilePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return { valid: false, reason: 'Empty or invalid path' };
  }

  // On Windows, strip drive letter before checking for invalid chars
  // Colon is valid in "C:\..." but not elsewhere
  let pathToCheck = filePath;
  if (process.platform === 'win32' && /^[a-zA-Z]:/.test(filePath)) {
    pathToCheck = filePath.substring(2);
  }

  const invalidChars = /[<>"|?*\x00-\x1F]/;
  if (invalidChars.test(pathToCheck)) {
    return { valid: false, reason: 'Path contains invalid characters' };
  }

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

  // Always sanitize output filename for invalid chars
  newName = newName.replace(/[<>:"|?*\x00-\x1F]/g, '_');

  if (settings.cleanFilename) {
    newName = sanitizeFilename(newName);
  }

  return newName + '.' + ext;
}

// Get output path for a conversion
function getOutputPath(inputPath, settings, format) {
  const parsedPath = path.parse(inputPath);
  let outputFilename;
  let outputDir;

  if (settings.replaceOriginal) {
    // Use the new format extension if converting to a different format
    const newExt = format || parsedPath.ext.substring(1);
    outputFilename = parsedPath.name + '.' + newExt;
    // Use temp subfolder to avoid overwriting original during conversion
    outputDir = path.join(parsedPath.dir, '_converting_tmp');
  } else {
    outputFilename = generateOutputFilename(inputPath, settings, format);

    if (settings.useSourceFolder === false && settings.outputFolder) {
      outputDir = settings.outputFolder;
    } else {
      outputDir = path.join(parsedPath.dir, 'converted');
    }
  }

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    try {
      fs.mkdirSync(outputDir, { recursive: true });
    } catch (error) {
      throw new Error(`Cannot create output folder: ${outputDir} — ${error.message}`);
    }
  }

  return path.join(outputDir, outputFilename);
}

// ============================================================
// FFmpeg Argument Builder
// ============================================================

function buildFFmpegArgs(inputPath, outputPath, settings, options = {}) {
  const args = [];
  const { pass, passlogfile } = options;
  const isPass1 = pass === 1;
  const outputExt = ((settings.videoFormat || path.extname(outputPath).slice(1) || '').toLowerCase());
  const isMp4Output = outputExt === 'mp4';

  const vCodec = settings.videoCodec || '';
  const isNvenc = vCodec.includes('nvenc');
  const isQsv = vCodec.includes('qsv');
  const isAmf = vCodec.includes('amf');
  const isHwEncoder = isNvenc || isQsv || isAmf;

  // Hardware acceleration MUST come BEFORE -i
  // Auto-set decode acceleration to match HW encoder, or use explicit setting
  if (isNvenc) {
    args.push('-hwaccel', 'cuda');
  } else if (isQsv) {
    args.push('-hwaccel', 'qsv');
  } else if (isAmf) {
    args.push('-hwaccel', 'dxva2');
  } else if (settings.hwAccel && settings.hwAccel !== '') {
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

  // Input
  args.push('-i', inputPath);

  // Thread count
  if (settings.threadCount && settings.threadCount !== '') {
    args.push('-threads', settings.threadCount);
  }

  // === VIDEO ===
  if (vCodec && vCodec !== 'none') {
    args.push('-c:v', vCodec);

    if (vCodec !== 'copy') {
      // Bitrate/quality: target size uses calculated bitrate, otherwise CRF/CQ
      if (settings._calculatedVideoBitrate) {
        if (isNvenc) {
          // NVENC: use VBR rate control with target bitrate + headroom
          const brStr = settings._calculatedVideoBitrate;
          const brKbps = parseInt(brStr);
          args.push('-rc', 'vbr', '-b:v', brStr);
          args.push('-maxrate', Math.round(brKbps * 1.5) + 'k');
          args.push('-bufsize', Math.round(brKbps * 2) + 'k');
        } else if (isQsv) {
          const brStr = settings._calculatedVideoBitrate;
          const brKbps = parseInt(brStr);
          args.push('-b:v', brStr);
          args.push('-maxrate', Math.round(brKbps * 1.5) + 'k');
          args.push('-bufsize', Math.round(brKbps * 2) + 'k');
        } else if (isAmf) {
          const brStr = settings._calculatedVideoBitrate;
          const brKbps = parseInt(brStr);
          args.push('-rc', 'vbr_peak', '-b:v', brStr);
          args.push('-maxrate', Math.round(brKbps * 1.5) + 'k');
          args.push('-bufsize', Math.round(brKbps * 2) + 'k');
        } else {
          // Software encoders: simple -b:v for 2-pass
          args.push('-b:v', settings._calculatedVideoBitrate);
        }
      } else if (settings.videoCrf !== undefined && settings.videoCrf !== '') {
        // Quality-based encoding (no target size)
        if (isNvenc) {
          args.push('-rc', 'vbr', '-cq', String(settings.videoCrf));
        } else if (isQsv) {
          args.push('-global_quality', String(settings.videoCrf));
        } else if (isAmf) {
          args.push('-rc', 'vbr_latency', '-qp_i', String(settings.videoCrf), '-qp_p', String(settings.videoCrf));
        } else {
          args.push('-crf', String(settings.videoCrf));
        }
      } else if (settings.videoBitrate) {
        args.push('-b:v', settings.videoBitrate + 'k');
      }

      // Preset — software encoders use -preset, NVENC uses its own preset names
      if (settings.videoPreset) {
        if (['libx264', 'libx265'].includes(vCodec)) {
          args.push('-preset', settings.videoPreset);
        } else if (isNvenc) {
          // NVENC preset mapping: slow→p7, medium→p4, fast→p1
          const nvencPresets = { ultrafast: 'p1', superfast: 'p1', veryfast: 'p2', faster: 'p3', fast: 'p4', medium: 'p4', slow: 'p5', slower: 'p6', veryslow: 'p7' };
          const nvPreset = nvencPresets[settings.videoPreset];
          if (nvPreset) args.push('-preset', nvPreset);
        }
      }

      // Resolution — use scale filter to preserve aspect ratio
      if (settings.videoResolution && settings.videoResolution !== '') {
        const height = parseInt(settings.videoResolution, 10);
        if (!isNaN(height) && height > 0) {
          args.push('-vf', `scale=-2:${height}`);
        } else if (settings.videoResolution.includes('x')) {
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

      // GOP size
      if (settings.videoGop && settings.videoGop !== '') {
        args.push('-g', settings.videoGop);
      }

      // B-frames
      if (settings.videoBframes && settings.videoBframes !== '') {
        args.push('-bf', settings.videoBframes);
      }

      // Video filters (additional, if no resolution scale was added)
      if (settings.videoFilters && settings.videoFilters !== '') {
        const vfIdx = args.indexOf('-vf');
        if (vfIdx !== -1) {
          args[vfIdx + 1] += ',' + settings.videoFilters;
        } else {
          args.push('-vf', settings.videoFilters);
        }
      }
    }
  } else if (vCodec === 'none') {
    args.push('-vn');
  }

  // === AUDIO (skip on pass 1 — not needed for analysis) ===
  if (isPass1) {
    args.push('-an');
  } else {
    const aCodec = settings.audioCodec;
    if (aCodec && aCodec !== 'none') {
      args.push('-c:a', aCodec);

      if (aCodec !== 'copy') {
        if (settings.audioBitrate && settings.audioBitrate !== '') {
          const br = String(settings.audioBitrate);
          args.push('-b:a', br.endsWith('k') ? br : br + 'k');
        }

        if (settings.audioSamplerate && settings.audioSamplerate !== '') {
          args.push('-ar', settings.audioSamplerate);
        }

        if (settings.audioChannels && settings.audioChannels !== '') {
          args.push('-ac', settings.audioChannels);
        }
      }
    } else if (aCodec === 'none') {
      args.push('-an');
    }
  }

  // === SUBTITLES (skip on pass 1) ===
  if (!isPass1) {
    if (settings.subtitleMode === 'copy') {
      // MP4 cannot mux common text subtitle codecs like subrip via stream copy.
      // Re-encode subtitles to mov_text for MP4 outputs to avoid header write failures.
      if (isMp4Output) {
        args.push('-c:s', 'mov_text');
      } else {
        args.push('-c:s', 'copy');
      }
    } else if (settings.subtitleMode === 'none') {
      args.push('-sn');
    }
  }

  // === METADATA ===
  if (settings.metadataMode === 'strip') {
    args.push('-map_metadata', '-1');
  }

  // === CUSTOM ARGS ===
  if (settings.customVideoArgs && settings.customVideoArgs.trim() !== '') {
    args.push(...settings.customVideoArgs.trim().split(/\s+/));
  }
  if (!isPass1) {
    if (settings.customAudioArgs && settings.customAudioArgs.trim() !== '') {
      args.push(...settings.customAudioArgs.trim().split(/\s+/));
    }
  }
  if (settings.globalCustomArgs && settings.globalCustomArgs.trim() !== '') {
    args.push(...settings.globalCustomArgs.trim().split(/\s+/));
  }

  // === 2-PASS FLAGS ===
  if (pass) {
    args.push('-pass', String(pass));
    if (passlogfile) {
      args.push('-passlogfile', passlogfile);
    }
  }

  // Overwrite — always -y for pass 1 (writing to null anyway)
  if (isPass1) {
    args.push('-y');
  } else if (settings.overwriteMode === 'yes') {
    args.push('-y');
  } else if (settings.overwriteMode === 'no') {
    args.push('-n');
  } else {
    args.push('-y');
  }

  // Progress
  args.push('-progress', 'pipe:1');

  // Output — pass 1 writes to null device, pass 2 / single-pass writes to file
  if (isPass1) {
    args.push('-f', 'null');
    args.push(process.platform === 'win32' ? 'NUL' : '/dev/null');
  } else {
    args.push(outputPath);
  }

  return args;
}

// ============================================================
// Progress Parsing
// ============================================================

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
    const currentTime = parseInt(progress.out_time_ms) / 1000000;
    const percent = Math.min((currentTime / duration) * 100, 100);

    return {
      percent,
      fps: progress.fps || '0',
      speed: progress.speed || '0x',
      time: currentTime,
      remaining: duration - currentTime
    };
  }

  return null;
}

// ============================================================
// FFprobe Duration
// ============================================================

async function getVideoDuration(filePath) {
  if (!ffprobePath) return null;

  return new Promise((resolve) => {
    const args = [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ];

    const proc = spawn(ffprobePath, args);
    let output = '';
    let killed = false;

    // Kill ffprobe if it hangs for more than 15 seconds
    const timeout = setTimeout(() => {
      killed = true;
      try { proc.kill('SIGKILL'); } catch (e) {}
      resolve(null);
    }, 15000);

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.on('close', () => {
      clearTimeout(timeout);
      if (killed) return;
      const duration = parseFloat(output.trim());
      resolve(isNaN(duration) ? null : duration);
    });

    proc.on('error', () => {
      clearTimeout(timeout);
      if (killed) return;
      resolve(null);
    });
  });
}

// ============================================================
// Core Conversion
// ============================================================

function sendLog(message) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('conversion-log', message);
  }
  console.log(`[convert] ${message}`);
}

// Run a single FFmpeg pass — returns a Promise that resolves on success, rejects on error
function runFFmpegPass(args, duration, fileIndex, passLabel) {
  return new Promise((resolve, reject) => {
    console.log('FFmpeg command:', ffmpegPath, args.join(' '));

    const proc = spawn(ffmpegPath, args);
    activeFFmpegProcess = proc;
    let errorOutput = '';

    function sendProgress(data) {
      if (!duration || !mainWindow || mainWindow.isDestroyed()) return;
      const prog = parseProgress(data, duration);
      if (!prog) return;

      const etaStr = prog.remaining > 0
        ? `${Math.floor(prog.remaining / 60)}m ${Math.floor(prog.remaining % 60)}s`
        : 'finishing...';

      mainWindow.webContents.send('conversion-progress', {
        fileIndex,
        progress: prog.percent,
        speed: `${prog.fps} fps`,
        eta: etaStr,
        passLabel: passLabel || null
      });
    }

    proc.stdout.on('data', sendProgress);
    proc.stderr.on('data', (data) => {
      errorOutput += data.toString();
      sendProgress(data);
    });

    proc.on('close', (code) => {
      activeFFmpegProcess = null;
      if (code === 0) {
        resolve();
      } else {
        // Extract meaningful error message
        let errorMessage = 'Conversion failed';
        if (errorOutput.includes('No NVENC capable devices found')) {
          errorMessage = 'GPU does not support this codec — try software encoding (H.264/H.265) or disable hardware acceleration';
        } else if (errorOutput.includes('Cannot load') && errorOutput.includes('nvenc')) {
          errorMessage = 'NVENC not available — GPU may not support hardware encoding for this codec. Disable HW acceleration or use H.264';
        } else if (errorOutput.includes('Invalid data found')) {
          errorMessage = 'Invalid or corrupted input file';
        } else if (errorOutput.includes('No such file or directory')) {
          errorMessage = 'File not found or path contains invalid characters';
        } else if (errorOutput.includes('Permission denied')) {
          errorMessage = 'Permission denied — check file/folder permissions';
        } else if (errorOutput.includes('No space left on device') || errorOutput.includes('ENOSPC')) {
          errorMessage = 'No disk space left — free up space or use a different output drive';
        } else if (errorOutput.includes('Unknown encoder') || (errorOutput.includes('Encoder') && errorOutput.includes('not found'))) {
          errorMessage = 'Codec not available — try a different codec or update FFmpeg';
        } else {
          // Try to find the most relevant error line from FFmpeg output
          const errorLines = errorOutput.split('\n').filter(line => {
            const l = line.trim();
            return l && (
              l.includes('Error') || l.includes('error') ||
              l.includes('failed') || l.includes('Invalid') ||
              l.includes('not supported') || l.includes('Conversion failed') ||
              l.includes('does not support') || l.includes('incompatible')
            );
          });
          if (errorLines.length > 0) {
            // Take the last meaningful error line, cleaned up
            errorMessage = errorLines[errorLines.length - 1].trim();
            // Cap length for the summary — full output is in details
            if (errorMessage.length > 200) {
              errorMessage = errorMessage.substring(0, 200) + '…';
            }
          } else {
            errorMessage = `Conversion failed (exit code ${code})`;
          }
        }
        const err = new Error(errorMessage);
        // Attach the last chunk of FFmpeg stderr for the UI to display
        const stderrLines = errorOutput.split('\n').filter(l => l.trim());
        err.ffmpegOutput = stderrLines.slice(-20).join('\n');
        reject(err);
      }
    });

    proc.on('error', (err) => {
      activeFFmpegProcess = null;
      reject(new Error(`Failed to start FFmpeg: ${err.message}`));
    });
  });
}

// Clean up 2-pass log files created by FFmpeg
function cleanupPasslogFiles(prefix) {
  const patterns = [`${prefix}-0.log`, `${prefix}-0.log.mbtree`];
  for (const file of patterns) {
    try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch (e) {}
  }
}

async function convertFile(inputPath, settings, fileIndex) {
  // Validate input
  const validation = isValidFilePath(inputPath);
  if (!validation.valid) {
    throw new Error(`Invalid file: ${validation.reason}`);
  }

  // Determine output path
  const outputPath = getOutputPath(inputPath, settings, settings.videoFormat);

  // Check if output already exists (non-replace mode)
  if (!settings.replaceOriginal && fs.existsSync(outputPath) && settings.overwriteMode === 'no') {
    return {
      success: true,
      output: outputPath,
      skipped: true,
      message: 'File already exists (skipped)'
    };
  }

  // Get duration for progress and bitrate calculation
  const duration = await getVideoDuration(inputPath);

  // Calculate target bitrate if size target is set
  let use2Pass = false;
  if (settings.targetSizeMB && settings.targetSizeMB > 0 && duration) {
    const targetBytes = settings.targetSizeMB * 1024 * 1024;

    // Skip files already under the target size — no point bloating them up
    let inputSize = 0;
    try { inputSize = fs.statSync(inputPath).size; } catch (e) {}

    if (inputSize > 0 && inputSize <= targetBytes) {
      sendLog(`Skipped: ${path.basename(inputPath)} is already ${(inputSize / 1024 / 1024).toFixed(0)} MB (under ${settings.targetSizeMB} MB target)`);
      return {
        success: true,
        output: inputPath,
        outputSize: inputSize,
        skipped: true,
        message: `Already under target size (${(inputSize / 1024 / 1024).toFixed(0)} MB)`
      };
    }

    const audioBitrateKbps = parseInt(settings.audioBitrate) || 192;
    const audioBitsTotal = audioBitrateKbps * 1000 * duration;
    const videoBitsTotal = (targetBytes * 8) - audioBitsTotal;
    const videoBitrateKbps = Math.max(100, Math.floor(videoBitsTotal / duration / 1000));

    settings = { ...settings, _calculatedVideoBitrate: videoBitrateKbps + 'k' };

    // HW encoders (NVENC/QSV/AMF) don't support traditional file-based 2-pass —
    // they use VBR rate control in a single pass, which buildFFmpegArgs handles
    const codec = settings.videoCodec || '';
    const isHwEncoder = codec.includes('nvenc') || codec.includes('qsv') || codec.includes('amf');
    use2Pass = !isHwEncoder;

    const mode = isHwEncoder ? '1-pass VBR (hardware)' : '2-pass';
    sendLog(`Target: ${settings.targetSizeMB} MB → video bitrate: ${videoBitrateKbps} kbps [${mode}] (duration: ${Math.round(duration)}s, current: ${(inputSize / 1024 / 1024).toFixed(0)} MB)`);
  } else if (settings.targetSizeMB && settings.targetSizeMB > 0 && !duration) {
    sendLog(`Warning: Could not determine duration — falling back to CRF mode`);
  }

  console.log('=== Conversion ===');
  console.log('Input:  ', inputPath);
  console.log('Output: ', outputPath);
  if (use2Pass) console.log('Mode:    2-pass target size');

  try {
    if (use2Pass) {
      // 2-pass encoding for accurate size targeting
      const passlogfile = path.join(path.dirname(outputPath), `_ffpass_${Date.now()}`);

      // Pass 1: analysis (output to null)
      sendLog(`Pass 1/2: Analyzing ${path.basename(inputPath)}`);
      const pass1Args = buildFFmpegArgs(inputPath, outputPath, settings, { pass: 1, passlogfile });
      await runFFmpegPass(pass1Args, duration, fileIndex, 'Pass 1/2');

      // Pass 2: actual encode
      sendLog(`Pass 2/2: Encoding ${path.basename(inputPath)}`);
      const pass2Args = buildFFmpegArgs(inputPath, outputPath, settings, { pass: 2, passlogfile });
      await runFFmpegPass(pass2Args, duration, fileIndex, 'Pass 2/2');

      // Clean up passlog files
      cleanupPasslogFiles(passlogfile);
    } else {
      // Single-pass encoding (CRF mode)
      sendLog(`Starting: ${path.basename(inputPath)}`);
      const args = buildFFmpegArgs(inputPath, outputPath, settings);
      await runFFmpegPass(args, duration, fileIndex);
    }

    // Get output file size
    let outputSize = 0;
    try { outputSize = fs.statSync(outputPath).size; } catch (e) {}

    // Handle replace original
    if (settings.replaceOriginal) {
      try {
        // Delete original
        if (fs.existsSync(inputPath)) {
          fs.unlinkSync(inputPath);
        }

        // Move converted file to original location
        const destPath = path.join(path.dirname(inputPath), path.basename(outputPath));
        fs.renameSync(outputPath, destPath);

        // Clean up temp dir if empty
        const tmpDir = path.dirname(outputPath);
        try {
          if (fs.readdirSync(tmpDir).length === 0) fs.rmdirSync(tmpDir);
        } catch (e) {}

        sendLog(`Replaced original: ${path.basename(inputPath)}`);
        return { success: true, output: destPath, outputSize, replaced: true };
      } catch (err) {
        throw new Error(`Conversion OK but failed to replace original: ${err.message}`);
      }
    } else {
      sendLog(`Complete: ${path.basename(outputPath)}`);
      return { success: true, output: outputPath, outputSize };
    }
  } catch (err) {
    // Clean up partial output and temp files on failure
    try {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      const tmpDir = path.dirname(outputPath);
      if (tmpDir.endsWith('_converting_tmp') && fs.existsSync(tmpDir) && fs.readdirSync(tmpDir).length === 0) {
        fs.rmdirSync(tmpDir);
      }
    } catch (e) {}

    throw err;
  }
}

// ============================================================
// Window
// ============================================================

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 15, y: 10 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'),
      devTools: true
    },
    backgroundColor: '#1e1e1e',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    minWidth: 900,
    minHeight: 600
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('closed', () => {
    // Kill any active ffmpeg process to prevent zombies
    if (activeFFmpegProcess) {
      try { activeFFmpegProcess.kill('SIGKILL'); } catch (e) {}
      activeFFmpegProcess = null;
    }
    mainWindow = null;
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
    }
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer ${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load page:', errorCode, errorDescription);
  });
}

// ============================================================
// App Lifecycle
// ============================================================

app.whenReady().then(() => {
  userDataPath = app.getPath('userData');

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

// ============================================================
// IPC Handlers
// ============================================================

// Supported media extensions
const MEDIA_EXTENSIONS = new Set([
  '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v',
  '.mpg', '.mpeg', '.ts',
  '.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.wma'
]);

// --- File Selection ---

// Select individual files (returns {files: [path, ...], metadata: {path: {size, ...}}})
ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Video Files', extensions: ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg', 'ts'] },
      { name: 'Audio Files', extensions: ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'wma'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled) return { files: [], metadata: {} };

  const metadata = {};
  result.filePaths.forEach(filePath => {
    try {
      const stats = fs.statSync(filePath);
      metadata[filePath] = {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      };
    } catch (error) {
      metadata[filePath] = { size: 0 };
    }
  });

  return { files: result.filePaths, metadata };
});

// Select folder and scan for media files
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  if (result.canceled) return { files: [], metadata: {} };

  const folderPath = result.filePaths[0];
  const files = [];
  const metadata = {};

  function scanDirectory(dir) {
    let items;
    try {
      items = fs.readdirSync(dir);
    } catch (err) {
      console.error(`Cannot read directory: ${dir} — ${err.message}`);
      return;
    }

    for (const item of items) {
      const fullPath = path.join(dir, item);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch (err) {
        continue; // skip inaccessible files
      }

      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (stat.isFile()) {
        const ext = path.extname(item).toLowerCase();
        if (MEDIA_EXTENSIONS.has(ext)) {
          files.push(fullPath);
          metadata[fullPath] = {
            size: stat.size,
            created: stat.birthtime,
            modified: stat.mtime
          };
        }
      }
    }
  }

  scanDirectory(folderPath);
  return { files, metadata };
});

// Scan a specific folder (used by renderer.js if present)
ipcMain.handle('scan-folder', async (event, folderPath, recursive) => {
  try {
    if (!folderPath || !fs.existsSync(folderPath)) {
      return { error: 'Folder does not exist', files: [] };
    }

    const files = [];

    function scan(dir) {
      let items;
      try {
        items = fs.readdirSync(dir);
      } catch (err) {
        return;
      }

      for (const item of items) {
        const fullPath = path.join(dir, item);
        let stat;
        try {
          stat = fs.statSync(fullPath);
        } catch (err) {
          continue;
        }

        if (stat.isDirectory() && recursive) {
          scan(fullPath);
        } else if (stat.isFile()) {
          const ext = path.extname(item).toLowerCase();
          if (MEDIA_EXTENSIONS.has(ext)) {
            files.push({ path: fullPath, size: stat.size });
          }
        }
      }
    }

    scan(folderPath);
    return { files };
  } catch (error) {
    return { error: error.message, files: [] };
  }
});

// Select a single file
ipcMain.handle('select-file', async (event, title) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: title || 'Select File',
    properties: ['openFile'],
    filters: [{ name: 'All Files', extensions: ['*'] }]
  });
  return result.canceled ? null : result.filePaths[0];
});

// Select output folder
ipcMain.handle('select-output-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Output Folder',
    properties: ['openDirectory', 'createDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

// --- Conversion ---

ipcMain.handle('convert-file', async (event, inputPath, settings, fileIndex) => {
  try {
    const result = await convertFile(inputPath, settings, fileIndex);
    return result;
  } catch (error) {
    return { success: false, error: error.message, details: error.ffmpegOutput || null };
  }
});

// --- FFmpeg Status ---

ipcMain.handle('check-ffmpeg-status', async () => {
  if (!ffmpegPath) {
    return { available: false, version: null, ffmpegPath: null };
  }

  try {
    const version = execSync(`"${ffmpegPath}" -version`, { encoding: 'utf8' });
    const versionMatch = version.match(/ffmpeg version ([^\s]+)/);

    return {
      available: true,
      version: versionMatch ? versionMatch[1] : 'Unknown',
      ffmpegPath
    };
  } catch (error) {
    return { available: false, version: null, ffmpegPath: null };
  }
});

// Alias for renderer.js compatibility
ipcMain.handle('check-ffmpeg', async () => {
  if (!ffmpegPath) {
    return { available: false, version: null, ffmpegPath: null };
  }
  try {
    const version = execSync(`"${ffmpegPath}" -version`, { encoding: 'utf8' });
    const versionMatch = version.match(/ffmpeg version ([^\s]+)/);
    return {
      available: true,
      version: versionMatch ? versionMatch[1] : 'Unknown',
      ffmpegPath
    };
  } catch (error) {
    return { available: false, version: null, ffmpegPath: null };
  }
});

ipcMain.handle('test-ffmpeg', async (event, customPath) => {
  const testPath = customPath || ffmpegPath;

  if (!testPath) {
    return { success: false, error: 'No FFmpeg path specified' };
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
    return { success: false, error: error.message };
  }
});

// Install FFmpeg — opens download page
ipcMain.handle('install-ffmpeg', async () => {
  try {
    let url;
    if (process.platform === 'win32') {
      url = 'https://www.gyan.dev/ffmpeg/builds/';
    } else if (process.platform === 'darwin') {
      url = 'https://formulae.brew.sh/formula/ffmpeg';
    } else {
      url = 'https://ffmpeg.org/download.html';
    }
    await shell.openExternal(url);
    return { message: 'Opened FFmpeg download page. Install FFmpeg and restart the app.' };
  } catch (error) {
    return { error: error.message };
  }
});

// Set custom FFmpeg path via file picker
ipcMain.handle('set-ffmpeg-path', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select FFmpeg Executable',
    properties: ['openFile'],
    filters: process.platform === 'win32'
      ? [{ name: 'Executable', extensions: ['exe'] }]
      : [{ name: 'All Files', extensions: ['*'] }]
  });

  if (result.canceled) return { success: false };

  const selectedPath = result.filePaths[0];
  try {
    const version = execSync(`"${selectedPath}" -version`, { encoding: 'utf8' });
    const versionMatch = version.match(/ffmpeg version ([^\s]+)/);

    ffmpegPath = selectedPath;
    ffprobePath = findSystemFFprobe();

    return {
      success: true,
      ffmpegPath: selectedPath,
      version: versionMatch ? versionMatch[1] : 'Unknown'
    };
  } catch (error) {
    return { success: false, error: 'Selected file is not a valid FFmpeg executable' };
  }
});

// --- Presets ---

ipcMain.handle('save-presets', async (event, presets) => {
  try {
    const presetsPath = path.join(userDataPath, 'presets.json');
    fs.writeFileSync(presetsPath, JSON.stringify(presets, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-presets', async () => {
  try {
    const presetsPath = path.join(userDataPath, 'presets.json');
    if (fs.existsSync(presetsPath)) {
      return JSON.parse(fs.readFileSync(presetsPath, 'utf8'));
    }
    return {};
  } catch (error) {
    return {};
  }
});

// --- Settings ---

ipcMain.handle('save-settings', async (event, settings) => {
  try {
    const settingsPath = path.join(userDataPath, 'settings.json');
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-settings', async () => {
  try {
    const settingsPath = path.join(userDataPath, 'settings.json');
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
    return {};
  } catch (error) {
    return {};
  }
});

// --- Misc ---

ipcMain.handle('open-external', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// --- Window Controls ---

ipcMain.handle('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});
