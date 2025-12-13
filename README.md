# FFmpeg Video Converter (GUI) 🎬

A simple cross-platform desktop app for converting videos using FFmpeg — no command line needed. Just point, click, and convert!

---

## 🚀 Features

- Cross-platform: Windows, macOS, Linux  
- Built with Electron  
- Uses FFmpeg under the hood  
- Easy video conversion without touching the terminal  

---

## 🛠 Requirements

Make sure you have the following installed on your system:

- **FFmpeg** installed and on your PATH (if you do not have it, you will be asked if you want to installed it when running the app)

Download FFmpeg here: [https://www.ffmpeg.org/](https://www.ffmpeg.org/)

---

## 💻 Running from Source

Follow these steps to get the app running locally:

**1. Clone the repository**

```bash
git clone https://github.com/Claymaver/ffmpeg-Converter-GUI.git
cd ffmpeg-Converter-GUI
```

**2. Install dependencies**

```bash
npm install
```

**3. Start the app**

```bash
npm start
```

The Electron app should launch and be ready to use.

---

## 📦 Building for Distribution

We use **electron-builder** to create platform-specific installers.

### Windows

```bash
npm run dist-win
```

Generates `.exe` (portable) and `.nsis` installer files in the `dist/` folder.

### macOS

```bash
npm run dist-mac
```

Creates a `.dmg` installer in `dist/`.

### Linux

```bash
npm run dist-linux
```

Produces `.AppImage` and `.deb` packages in `dist/`.

> All build artifacts are output to the `dist/` directory.

---

## ⚠️ Notes

- FFmpeg must be available on your system PATH, or the app won’t find it.  
- macOS builds aren’t signed, so you may see a security warning the first time you open them.  

---

## 📄 About

**Author:** Clay MacDonald  
Built with Electron + FFmpeg for simple, quick video conversions.

---

## ❤️ Contributing

Contributions are welcome! Fork the repo, make your changes, and open a PR.  
Feel free to open an issue if you spot a bug or have a feature request.

---

## 📜 License

Check the `LICENSE` file in the repository.
 