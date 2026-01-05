# FFmpeg Video Converter

A cross-platform desktop application for batch video conversion with a modern graphical interface. Built with Electron and fluent-ffmpeg, this tool provides an easy way to convert, compress, and optimize video files without command-line knowledge.

## Features

### Core Functionality
- Batch Processing: Convert multiple video files simultaneously with queue management
- Custom Presets: Save and reuse your favorite encoding settings for different use cases
- Real-time Progress: Live progress bars and statistics for each file being converted
- Flexible Input: Select entire folders or individual files for conversion
- Auto-replace Option: Automatically replace original files with converted versions
- Smart Filename Cleaning: Removes quality tags, brackets, and unwanted metadata from filenames

### Video Encoding
- Multiple Codecs: H.264 (x264), H.265 (x265/HEVC), and VP9 support
- Quality Control: Adjustable CRF values from 0-51 for precise quality/size balance
- Resolution Scaling: Automatic downscaling to target resolution while preserving aspect ratio
- Encoding Speed Presets: Nine speed options from ultrafast to veryslow
- Built-in Presets: Optimized settings for TV shows, movies, high quality, and small file sizes

### Audio Processing
- Multiple Audio Codecs: AAC, Opus, MP3, or passthrough (copy original)
- Bitrate Control: Adjustable audio bitrate from 64-320 kbps
- Multi-track Support: Preserves all audio tracks from source files

### Subtitle Support
- Automatic Passthrough: All subtitle tracks are copied without re-encoding
- Format Preservation: Maintains original subtitle formats and languages

### User Interface
- Modern Dark Theme: Easy on the eyes with a professional appearance
- Two-column Layout: Settings on left, file list on right for efficient workflow
- Organized Settings: Grouped by preset management, video, audio, and post-processing
- Live Statistics: Real-time counters for total, successful, and failed conversions

### FFmpeg Integration
- Automatic Detection: Checks for FFmpeg installation on startup
- One-click Installation: Integrated installer for Windows (winget), macOS (Homebrew), and Linux (apt/snap)
- Cross-platform Support: Works on Windows 10+, macOS 10.13+, and modern Linux distributions

## Installation

### From Release (Recommended)

Download the latest release for your platform from the Releases page:

Windows
- FFmpeg-Video-Converter-x.x.x-win-x64.exe - Full installer with start menu shortcuts
- FFmpeg-Video-Converter-x.x.x-Portable.exe - Portable version, no installation required
- FFmpeg-Video-Converter-x.x.x-win-x64.zip - Manual extraction archive

macOS
- FFmpeg-Video-Converter-x.x.x-mac-x64.dmg - Intel Macs
- FFmpeg-Video-Converter-x.x.x-mac-arm64.dmg - Apple Silicon (M1/M2/M3)
- Universal builds support both architectures

Linux
- FFmpeg-Video-Converter-x.x.x-x86_64.AppImage - Universal format, run anywhere
- FFmpeg-Video-Converter-x.x.x-amd64.deb - Debian/Ubuntu/Mint package
- FFmpeg-Video-Converter-x.x.x-x86_64.rpm - Fedora/RHEL/CentOS package

### From Source

Requirements:
- Node.js 18 or higher
- npm 8 or higher
```bash
# Clone the repository
git clone https://github.com/yourusername/ffmpeg-converter-gui.git
cd ffmpeg-converter-gui

# Install dependencies
npm install

# Run the application
npm start
```

## Usage

### First Launch

1. Install FFmpeg: If FFmpeg is not detected, a banner will appear with an "Install FFmpeg Automatically" button
   - Windows: Uses winget package manager
   - macOS: Uses Homebrew (must be installed separately)
   - Linux: Uses apt or snap
   
2. Manual Installation: If automatic installation fails, download FFmpeg from ffmpeg.org and add it to your system PATH

### Basic Workflow

1. Select Files: Click "Folder" to convert all videos in a directory, or "Files" to select specific videos
2. Choose Settings: 
   - Use a built-in preset (TV Shows, Movies, High Quality, Small Size)
   - Or customize video codec, quality (CRF), resolution, audio settings, and encoding speed
3. Save Custom Presets: Enter a name and click the save button to reuse settings later
4. Configure Post-Processing: Check "Auto-replace original files" to automatically delete originals after successful conversion
5. Start Conversion: Click "Convert" and monitor real-time progress
6. Review Results: Converted files are in the `converted` subfolder (unless auto-replace is enabled)

### Settings Explained

Video Settings
- Resolution Height: Target vertical resolution in pixels (e.g., 720, 1080, 2160)
- Quality (CRF): Constant Rate Factor - lower = better quality, larger files (18-28 recommended)
- Preset: Encoding speed - slower = better compression but longer processing time
- Codec: H.264 (best compatibility), H.265 (better compression), VP9 (open source)

Audio Settings
- Codec: AAC (best compatibility), Opus (best quality/size), MP3 (universal), Copy (no re-encode)
- Bitrate: Audio quality in kbps - 128-192 recommended for most content

Post-Processing
- Auto-replace: Deletes original files and moves converted files to original location (use with caution)

### Recommended Settings

TV Shows (720p, balanced)
- Resolution: 720p
- CRF: 28
- Preset: slow
- Codec: H.264
- Audio: AAC 192kbps

Movies (1080p, high quality)
- Resolution: 1080p
- CRF: 23
- Preset: slow
- Codec: H.264
- Audio: AAC 192kbps

Archival (maximum quality)
- Resolution: 1080p or original
- CRF: 18
- Preset: slower or veryslow
- Codec: H.264 or H.265
- Audio: AAC 256kbps or copy

Small Files (maximum compression)
- Resolution: 720p
- CRF: 30
- Preset: medium
- Codec: H.265
- Audio: AAC 128kbps

## Building

### Prerequisites
- Node.js 18+
- npm 8+

### Build Commands
```bash
# Install dependencies
npm install

# Build for all platforms (requires macOS for macOS builds)
npm run dist

# Build for specific platform
npm run dist-win    # Windows (NSIS, Portable, ZIP)
npm run dist-mac    # macOS (DMG for Intel and Apple Silicon)
npm run dist-linux  # Linux (AppImage, DEB, RPM)

# Development build (no packaging)
npm run pack
```

### Build Output

Builds are created in the `dist` folder:
- Windows: .exe installer, portable .exe, and .zip archive
- macOS: .dmg disk images for x64 and arm64
- Linux: .AppImage, .deb, and .rpm packages

### Testing Locally
```bash
npm start
```

### Debugging

Enable Electron DevTools by uncommenting in main.js:
```javascript
mainWindow.webContents.openDevTools();
```

## Troubleshooting

FFmpeg not detected
- Verify FFmpeg is installed: Run `ffmpeg -version` in terminal/command prompt
- Check PATH: Ensure FFmpeg directory is in your system PATH
- Restart application after manual installation

Conversion fails
- Check file format is supported
- Ensure sufficient disk space
- Verify source file is not corrupted (try playing in VLC)

Slow conversion speed
- Use faster preset (medium, fast, veryfast)
- Lower target resolution
- Check CPU usage (encoding is CPU-intensive)

Auto-replace doesn't work
- Ensure you have write permissions in source directory
- Check if antivirus is blocking file operations

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Credits

Built with:
- Electron - Cross-platform desktop framework
- fluent-ffmpeg - FFmpeg wrapper for Node.js
- electron-builder - Package and build tool

FFmpeg is a trademark of Fabrice Bellard, originator of the FFmpeg project.
