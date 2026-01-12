#!/bin/bash
# Post-install script for FFmpeg Converter Pro

# Create desktop file
DESKTOP_FILE="/usr/share/applications/ffmpeg-converter-pro.desktop"

# Set permissions
chmod +x /opt/FFmpeg\ Converter\ Pro/ffmpeg-converter-pro || true

echo "FFmpeg Converter Pro installed successfully!"
