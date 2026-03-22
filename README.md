# Minecraft World Editor - Web App

A professional browser-based Minecraft world editor that runs entirely on GitHub Pages. Edit your Minecraft: Bedrock Edition worlds directly in your browser!

## 🌟 Features

- **Import worlds** from folders or .mcworld files
- **Edit world settings**: name, seed, game mode, difficulty
- **Time control**: set day/night, sunrise, sunset
- **Weather control**: clear, rain, thunderstorms
- **Game rules**: cheats, keep inventory, coordinates, and more
- **Player data**: position, health, hunger, XP, abilities
- **Export worlds** as .mcworld files
- **100% local processing** - no data uploaded to any server

## 🚀 Live Demo

[View Live Demo](https://ayushghbk-afk.github.io/minecraft-world-eaditer-)

## 📥 How to Use

### Option 1: Import World Folder
1. Click "Select World Folder"
2. Navigate to your Minecraft worlds folder:
   - **Android**: `/storage/emulated/0/games/com.mojang/minecraftWorlds/`
   - **Windows**: `%appdata%\.minecraft\saves\`
   - **iOS**: Via Files app in Minecraft folder
3. Select the world folder
4. Start editing!

### Option 2: Import .mcworld File
1. Click "Import .mcworld"
2. Select your exported world file
3. Make your changes
4. Export back to .mcworld

## 📱 Mobile Support

Fully responsive and optimized for mobile devices:
- **Android**: Works in Chrome, Firefox, Samsung Internet
- **iOS**: Works in Safari, Chrome

## 🔒 Privacy

All processing happens **locally in your browser**. Your worlds never leave your device! No data is uploaded to any server.

## 🛠️ Built With

- HTML5/CSS3
- JavaScript (ES6+)
- JSZip for archive handling
- Prismarine-NBT for NBT parsing
- Font Awesome for icons

## 🎯 Features List

### ✅ Current Features
- [x] World folder import
- [x] .mcworld file import
- [x] Edit world name
- [x] Change game mode (Survival/Creative/Adventure/Spectator)
- [x] Change difficulty
- [x] Time control (presets + slider)
- [x] Weather control
- [x] Game rules (cheats, flight, etc.)
- [x] Player position editing
- [x] Player health/hunger/XP editing
- [x] Player abilities (flight, invulnerability)
- [x] Export as .mcworld

### 🔜 Coming Soon
- [ ] Inventory editor
- [ ] Structure placement
- [ ] Biome editor
- [ ] World painter
- [ ] Schematic import/export
- [ ] Multiple world formats support

## 🚀 Deployment to GitHub Pages

1. **Fork or clone this repository**
2. **Go to Settings** → **Pages**
3. **Select branch**: `main`
4. **Click Save**
5. Your site will be available at: `https://[your-username].github.io/[repo-name]/`

## 💻 Local Development

To run locally:

```bash
# Clone the repository
git clone https://github.com/ayushghbk-afk/minecraft-world-eaditer-.git

# Navigate to the directory
cd minecraft-world-eaditer-

# Start a local server (Python 3)
python -m http.server 8000

# Open in browser
# http://localhost:8000
