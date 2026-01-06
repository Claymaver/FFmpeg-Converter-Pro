# FFmpeg Converter Pro

Professional Electron-based video converter with FFmpeg auto-installation.

## Features

- 🎬 **Video Conversion**: Multiple codecs (H.264, H.265, VP9) and containers (MKV, MP4, WebM, AVI)
- 🎵 **Audio Processing**: AAC, Opus, MP3 with customizable bitrate
- 📁 **Batch Processing**: Convert folders recursively or select multiple files
- ⚡ **Quick Presets**: TV Shows, Movies, High Quality, Small Size
- 🎨 **Modern UI**: Beautiful purple gradient interface with real-time progress
- 🔧 **Auto-Install**: FFmpeg and FFprobe install automatically

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

This will automatically download FFmpeg binaries (~70MB).

### 2. Run the App

```bash
npm start
```

### 3. Build Installer

```bash
npm run build
```

Installers will be created in the `dist/` folder.

## Usage

1. Click **Folder** or **Files** to add videos
2. Choose a preset or customize settings:
   - **Video**: codec, resolution, quality (CRF), encoding speed
   - **Audio**: codec, bitrate
   - **Post-Processing**: filename cleaning, output location
3. Click **Start Conversion**
4. Monitor progress in real-time

## Presets

| Preset | Resolution | CRF | Codec | Best For |
|--------|-----------|-----|-------|----------|
| 📺 TV Shows | 720p | 28 | H.264 | Fast, good quality |
| 🎬 Movies | 1080p | 23 | H.264 | Balanced quality |
| ⭐ High Quality | 1080p | 18 | H.264 | Best quality |
| 💾 Small Size | 720p | 30 | H.265 | Space-saving |

## CRF Quality Guide

- **0-17**: Visually lossless (large files)
- **18-23**: High quality (recommended for movies)
- **24-28**: Good quality (recommended for TV)
- **29-35**: Acceptable quality (small files)
- **36-51**: Low quality

## Build for Distribution

### Windows
```bash
npm run build
```
Creates: `FFmpeg Converter Pro Setup.exe`

### macOS
```bash
npm run build
```
Creates: `FFmpeg Converter Pro.dmg`

### Linux
```bash
npm run build
```
Creates: `FFmpeg Converter Pro.AppImage`

## Development

### Run with DevTools
```bash
npm run dev
```

### Project Structure
```
ffmpeg-converter-pro/
├── src/
│   ├── main.js       - Electron main process (FFmpeg handlers)
│   ├── renderer.js   - UI logic and state management
│   ├── preload.js    - Security bridge
│   └── index.html    - User interface
├── package.json      - Dependencies and build config
└── .npmrc           - FFmpeg download timeout fix
```

## Requirements

- Node.js 16+ 
- Windows 10/11, macOS 10.13+, or Linux

## Troubleshooting

### FFmpeg not found
The app auto-installs FFmpeg on first run. If you see errors:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Build fails
Ensure electron-builder is installed:
```bash
npm install electron-builder --save-dev
```

### Slow downloads
The `.npmrc` file is configured for slow connections. If downloads still fail, try:
```bash
npm install --prefer-online
```

## License

MIT

## Credits

Built with:
- [Electron](https://www.electronjs.org/)
- [FFmpeg](https://ffmpeg.org/)
- [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg)
- [Tailwind CSS](https://tailwindcss.com/)
