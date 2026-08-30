#!/bin/bash
set -e

UUID="gnome-dock@danilo.projects"
TARGET_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"

echo "=== Building and Installing GNOME Dock Extension ==="

# 1. Compile Schemas
echo "-> Compiling GSettings schemas..."
glib-compile-schemas schemas/

# 2. Copy files to extension directory
echo "-> Installing files to $TARGET_DIR..."
mkdir -p "$TARGET_DIR"
cp -r metadata.json stylesheet.css extension.js prefs.js dockContainer.js dockItem.js dockManager.js schemas "$TARGET_DIR/"

# 3. Enable Extension
echo "-> Enabling extension..."
if command -v gnome-extensions >/dev/null 2>&1; then
    gnome-extensions enable "$UUID" || true
    echo "Extension enabled!"
else
    echo "gnome-extensions CLI not found. Please enable via GNOME Extensions app."
fi

echo ""
echo "Installation complete!"
echo "To configure preferences, run:"
echo "  gnome-extensions prefs $UUID"
