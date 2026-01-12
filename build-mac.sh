#!/bin/bash
# macOS Build Script for FFmpeg Converter Pro
# This script builds the application for macOS (Intel, Apple Silicon, Universal)

set -e  # Exit on error

echo "========================================"
echo "  FFmpeg Converter Pro - macOS Build"
echo "========================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "[1/4] Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "Dependencies not found. Installing..."
    npm install
else
    echo "Dependencies already installed."
fi

echo ""
echo "[2/4] Checking build resources..."
if [ ! -f "build/icon.icns" ]; then
    echo "WARNING: Icon file not found at build/icon.icns"
    echo "The build will continue but the app may not have an icon."
    sleep 3
fi

if [ ! -f "build/entitlements.mac.plist" ]; then
    echo "Creating default entitlements file..."
    mkdir -p build
    cat > build/entitlements.mac.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
</dict>
</plist>
EOF
    echo "Created build/entitlements.mac.plist"
fi

echo ""
echo "[3/4] Building application..."
echo "This may take several minutes..."
echo ""
echo "Building universal binary (Intel + Apple Silicon)..."

npm run build:mac-universal

echo ""
echo "[4/4] Build complete!"
echo ""
echo "========================================"
echo "  Build Results"
echo "========================================"

if [ -d "dist" ]; then
    echo ""
    echo "Files created in 'dist' folder:"
    ls -lh dist/*.dmg 2>/dev/null || echo "No DMG files found"
    ls -lh dist/*.zip 2>/dev/null || echo "No ZIP files found"
    echo ""
    echo "You can now distribute these files!"
else
    echo "WARNING: No dist folder found"
fi

echo ""
echo "========================================"
echo "  What's Next?"
echo "========================================"
echo ""
echo "1. Test the DMG: Open the .dmg file in the dist folder"
echo "2. Mount the DMG and drag the app to Applications"
echo "3. Test the application"
echo "4. Distribute the DMG to users"
echo ""
echo "Note: For App Store distribution, you'll need to:"
echo "  - Sign the app with your Apple Developer certificate"
echo "  - Notarize the app with Apple"
echo "  - Submit through App Store Connect"
echo ""

# Open dist folder if on macOS
if [ "$(uname)" == "Darwin" ]; then
    if [ -d "dist" ]; then
        echo "Opening dist folder..."
        open dist
    fi
fi
