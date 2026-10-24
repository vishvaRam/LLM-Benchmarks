#!/usr/bin/env bash
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

APP_NAME="llm-benchmarking-studio"
APP_DISPLAY_NAME="LLM Benchmarking Studio"
VERSION="1.2.0"
ARCH="amd64"
DEB_NAME="${APP_NAME}_${VERSION}_${ARCH}.deb"

RELEASE_DIR="${PROJECT_ROOT}/releases"
BUILD_DIR="${PROJECT_ROOT}/build"
STAGE_ROOT=$(mktemp -d /tmp/deb-build-XXXXXX)
PKG_DIR="${STAGE_ROOT}/${APP_NAME}_${VERSION}_${ARCH}"

echo "==> Project root: ${PROJECT_ROOT}"
echo "==> Cleaning old build artifacts..."
rm -rf build dist "${RELEASE_DIR}/${DEB_NAME}"
mkdir -p "${RELEASE_DIR}" "${BUILD_DIR}"

# 1. Build PyInstaller bundle
echo "==> Freezing application with PyInstaller..."
# Note: Linux PyInstaller uses ':' as path separator for --add-data
pyinstaller --noconfirm --onedir --windowed \
    --name "${APP_NAME}" \
    --specpath "${BUILD_DIR}" \
    --add-data "${PROJECT_ROOT}/app/static:app/static" \
    --add-data "${PROJECT_ROOT}/Images:Images" \
    --add-data "${PROJECT_ROOT}/data:data" \
    --add-data "${PROJECT_ROOT}/assets:assets" \
    --collect-all "uvicorn" \
    --collect-all "fastapi" \
    --collect-all "pymupdf" \
    --collect-all "starlette" \
    --collect-all "webview" \
    run_app.py

# 2. Setup standard Linux packaging filesystem
echo "==> Assembling deb package structure..."
mkdir -p "${PKG_DIR}/opt/${APP_NAME}"
mkdir -p "${PKG_DIR}/usr/bin"
mkdir -p "${PKG_DIR}/usr/share/applications"
mkdir -p "${PKG_DIR}/usr/share/icons/hicolor/512x512/apps"
mkdir -p "${PKG_DIR}/DEBIAN"

# Copy binary & runtime assets
cp -a "dist/${APP_NAME}/." "${PKG_DIR}/opt/${APP_NAME}/"
ln -s "/opt/${APP_NAME}/${APP_NAME}" "${PKG_DIR}/usr/bin/${APP_NAME}"

# Install desktop icon
cp "${PROJECT_ROOT}/assets/app_icon.png" "${PKG_DIR}/usr/share/icons/hicolor/512x512/apps/${APP_NAME}.png"

# 3. Generate Desktop Entry
cat << EOF > "${PKG_DIR}/usr/share/applications/${APP_NAME}.desktop"
[Desktop Entry]
Name=${APP_DISPLAY_NAME}
Comment=Inference Lab — LLM & VLM Benchmark Studio
Exec=/usr/bin/${APP_NAME}
Icon=${APP_NAME}
Terminal=false
Type=Application
Categories=Development;Utility;
StartupWMClass=${APP_NAME}
EOF

# 4. Generate Control File
cat << EOF > "${PKG_DIR}/DEBIAN/control"
Package: ${APP_NAME}
Version: ${VERSION}
Section: utils
Priority: optional
Architecture: ${ARCH}
Depends: python3-gi, gir1.2-gtk-3.0, gir1.2-webkit2-4.1
Maintainer: Vishva Ramamurthy
Description: LLM & VLM Benchmarking Studio
 Standalone native desktop telemetry and benchmark studio for LLMs and VLMs.
EOF

# 5. Fix permissions & Build Package
chmod -R 755 "${PKG_DIR}"
chmod 644 "${PKG_DIR}/DEBIAN/control"
chmod 644 "${PKG_DIR}/usr/share/applications/${APP_NAME}.desktop"
chmod 644 "${PKG_DIR}/usr/share/icons/hicolor/512x512/apps/${APP_NAME}.png"

echo "==> Building .deb package..."
dpkg-deb --build --root-owner-group "${PKG_DIR}" "${RELEASE_DIR}/${DEB_NAME}"
rm -rf "${STAGE_ROOT}"

echo "✅ Linux package generated at: ${RELEASE_DIR}/${DEB_NAME}"