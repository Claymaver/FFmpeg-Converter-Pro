@echo off
REM Windows Build Script for FFmpeg Converter Pro
REM This script builds the application for Windows (x64 and ia32)

echo ========================================
echo   FFmpeg Converter Pro - Windows Build
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [1/4] Checking dependencies...
if not exist "node_modules" (
    echo Dependencies not found. Installing...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: Failed to install dependencies!
        pause
        exit /b 1
    )
) else (
    echo Dependencies already installed.
)

echo.
echo [2/4] Checking build resources...
if not exist "build\icon.ico" (
    echo WARNING: Icon file not found at build\icon.ico
    echo The build will continue but the app may not have an icon.
    timeout /t 3 >nul
)

echo.
echo [3/4] Building application...
echo This may take several minutes...
echo.

call npm run build:win-all

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Build failed!
    echo Check the error messages above for details.
    pause
    exit /b 1
)

echo.
echo [4/4] Build complete!
echo.
echo ========================================
echo   Build Results
echo ========================================

if exist "dist\*.exe" (
    echo.
    echo Installers created in 'dist' folder:
    dir /b dist\*.exe
    echo.
    echo You can now distribute these files!
) else (
    echo WARNING: No installers found in dist folder
)

echo.
echo ========================================
echo   What's Next?
echo ========================================
echo.
echo 1. Test the installer: Run the .exe file in the dist folder
echo 2. Test the portable version: Run the portable .exe
echo 3. Distribute the installers to users
echo.
echo Press any key to open the dist folder...
pause >nul

if exist "dist" (
    start explorer "dist"
)
