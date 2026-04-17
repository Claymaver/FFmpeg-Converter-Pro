# FFmpeg Converter Pro

A professional, easy-to-use desktop application for batch video conversion powered by FFmpeg.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)
![Version](https://img.shields.io/badge/version-2.1.5-green.svg)

## Features

- **Batch Conversion** - Convert multiple videos at once
- **Individual Progress Tracking** - See progress on each file
- **Built-in Presets** - TV Shows, Movies, High Quality, Small Size
- **Custom Presets** - Save your own settings
- **Multiple Formats** - MKV, MP4, WebM, AVI
- **Video Codecs** - H.264, H.265/HEVC, VP9
- **Audio Options** - AAC, Opus, MP3
- **Subtitle Support** - Automatically copies all subtitle streams
- **FFmpeg Installer** - Install FFmpeg directly from the app
- **Large Activity Log** - See detailed conversion logs

## Quick Start

1. Install the application
2. Click "Install FFmpeg" if not already installed
3. Add videos using "Add Folder" or "Add Files"
4. Choose a preset or customize settings
5. Click "Start Conversion"

## Requirements

- **FFmpeg** must be installed on your system
  - The app can install it for you automatically on Windows/macOS
  - Linux: Install via package manager (`apt install ffmpeg`)

## Building from Source

### Prerequisites

- Node.js 18 or higher
- npm

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/ffmpeg-converter-pro.git
cd ffmpeg-converter-pro

# Install dependencies
npm install

# Run in development mode
npm start
```

### Build Installers

```bash
# Build for all platforms
npm run build:all

# Or build for specific platforms
npm run build:win      # Windows
npm run build:mac      # macOS
npm run build:linux    # Linux
```

## Usage

### Quick Presets

- **TV Shows** - 720p, fast encoding
- **Movies** - 1080p, balanced quality
- **High Quality** - 1080p, slow encoding, best quality
- **Small Size** - 720p, H.265, smaller file sizes

### Custom Settings

Navigate to the tabs to customize:

- **Video** - Codec, resolution, quality (CRF), encoding speed
- **Audio** - Codec, bitrate
- **Advanced** - FFmpeg settings

### Options

- **Output to "converted" folder** - Saves converted files to a subfolder
- **Clean filenames** - Removes quality tags and brackets
- **Replace original files** - ⚠️ Deletes originals after conversion (use with caution!)

## Features in Detail

### Batch Processing
- Add entire folders with recursive scanning
- Process multiple files sequentially
- Real-time progress for each file

### Subtitle & Audio Support
- Automatically copies all subtitle streams
- Preserves multiple audio tracks
- Maintains chapter markers and metadata

### FFmpeg Integration
- Auto-detects system FFmpeg
- Built-in installer for Windows (winget) and macOS (Homebrew)
- Manual installation instructions for Linux

## Troubleshooting

### FFmpeg Not Found

**Windows:**
```bash
winget install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# Fedora
sudo dnf install ffmpeg

# Arch
sudo pacman -S ffmpeg
```

### Build Issues

If builds fail:
```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- Powered by [FFmpeg](https://ffmpeg.org/)
- Uses [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg)
