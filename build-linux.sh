#!/bin/bash
# Linux Build Script for FFmpeg Converter Pro
# This script builds the application for Linux (AppImage, DEB, RPM)

set -e  # Exit on error

echo "========================================"
echo "  FFmpeg Converter Pro - Linux Build"
echo "========================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "[1/5] Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "Dependencies not found. Installing..."
    npm install
else
    echo "Dependencies already installed."
fi

echo ""
echo "[2/5] Checking build dependencies..."
# Check for required build tools
MISSING_DEPS=""

if ! command -v fakeroot &> /dev/null; then
    MISSING_DEPS="$MISSING_DEPS fakeroot"
fi

if ! command -v dpkg &> /dev/null; then
    MISSING_DEPS="$MISSING_DEPS dpkg"
fi

if [ -n "$MISSING_DEPS" ]; then
    echo "WARNING: Missing build dependencies:$MISSING_DEPS"
    echo "Install them with: sudo apt install$MISSING_DEPS"
    echo "Continuing anyway..."
    sleep 3
fi

echo ""
echo "[3/5] Checking build resources..."
if [ ! -d "build/icons" ]; then
    echo "WARNING: Icons folder not found at build/icons"
    echo "The build will continue but the app may not have icons."
    sleep 3
fi

# Create post-install scripts if they don't exist
if [ ! -f "build/linux-after-install.sh" ]; then
    echo "Creating post-install script..."
    mkdir -p build
    cat > build/linux-after-install.sh << 'EOF'
#!/bin/bash
# Post-install script for FFmpeg Converter Pro

# Create desktop file
DESKTOP_FILE="/usr/share/applications/ffmpeg-converter-pro.desktop"

# Set permissions
chmod +x /opt/FFmpeg\ Converter\ Pro/ffmpeg-converter-pro || true

echo "FFmpeg Converter Pro installed successfully!"
EOF
    chmod +x build/linux-after-install.sh
fi

if [ ! -f "build/linux-after-remove.sh" ]; then
    echo "Creating post-remove script..."
    cat > build/linux-after-remove.sh << 'EOF'
#!/bin/bash
# Post-remove script for FFmpeg Converter Pro

echo "FFmpeg Converter Pro uninstalled."
EOF
    chmod +x build/linux-after-remove.sh
fi

echo ""
echo "[4/5] Building application..."
echo "This may take several minutes..."
echo ""
echo "Building AppImage, DEB, and RPM packages..."

npm run build:linux-all

echo ""
echo "[5/5] Build complete!"
echo ""
echo "========================================"
echo "  Build Results"
echo "========================================"

if [ -d "dist" ]; then
    echo ""
    echo "Files created in 'dist' folder:"
    ls -lh dist/*.AppImage 2>/dev/null || echo "No AppImage files found"
    ls -lh dist/*.deb 2>/dev/null || echo "No DEB files found"
    ls -lh dist/*.rpm 2>/dev/null || echo "No RPM files found"
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
echo "AppImage (Universal - Recommended):"
echo "  - Works on all Linux distributions"
echo "  - No installation required"
echo "  - Just make executable: chmod +x file.AppImage"
echo "  - Run: ./file.AppImage"
echo ""
echo "DEB (Debian/Ubuntu):"
echo "  - Install: sudo dpkg -i file.deb"
echo "  - Or: sudo apt install ./file.deb"
echo ""
echo "RPM (Fedora/RHEL/CentOS):"
echo "  - Install: sudo rpm -i file.rpm"
echo "  - Or: sudo dnf install ./file.rpm"
echo ""
echo "Distribution:"
echo "  1. Test each package on target distros"
echo "  2. Upload to GitHub Releases"
echo "  3. Consider Snap/Flatpak for wider reach"
echo ""

# Open dist folder if possible
if [ -d "dist" ]; then
    if command -v xdg-open &> /dev/null; then
        echo "Opening dist folder..."
        xdg-open dist &
    elif command -v nautilus &> /dev/null; then
        nautilus dist &
    elif command -v dolphin &> /dev/null; then
        dolphin dist &
    fi
fi
