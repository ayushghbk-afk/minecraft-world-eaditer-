// Global state
let currentWorld = null;
let worldFiles = {};
let originalData = null;

// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const mcworldInput = document.getElementById('mcworldInput');
const loadingOverlay = document.getElementById('loadingOverlay');

// Initialize event listeners
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    setupTabSwitching();
});

function setupEventListeners() {
    // Upload area click
    if (uploadArea) {
        uploadArea.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON') {
                fileInput.click();
            }
        });
    }
    
    // File input handlers
    if (fileInput) fileInput.addEventListener('change', handleWorldFolderSelect);
    if (mcworldInput) mcworldInput.addEventListener('change', handleMcworldSelect);
    
    // Close world button
    const closeBtn = document.getElementById('closeWorldBtn');
    if (closeBtn) closeBtn.addEventListener('click', resetToImport);
    
    // Apply changes button
    const applyBtn = document.getElementById('applyChangesBtn');
    if (applyBtn) applyBtn.addEventListener('click', applyChanges);
    
    // Export button
    const exportBtn = document.getElementById('exportWorldBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportWorld);
    
    // Reset button
    const resetBtn = document.getElementById('resetWorldBtn');
    if (resetBtn) resetBtn.addEventListener('click', resetChanges);
    
    // Time slider
    const timeSlider = document.getElementById('timeSlider');
    const worldTime = document.getElementById('worldTime');
    
    if (timeSlider && worldTime) {
        timeSlider.addEventListener('input', (e) => {
            worldTime.value = e.target.value;
        });
        
        worldTime.addEventListener('input', (e) => {
            timeSlider.value = e.target.value;
        });
    }
    
    // Weather checkboxes
    const isRaining = document.getElementById('isRaining');
    const isThundering = document.getElementById('isThundering');
    
    if (isRaining && isThundering) {
        isRaining.addEventListener('change', (e) => {
            if (e.target.checked && isThundering) isThundering.checked = false;
        });
        
        isThundering.addEventListener('change', (e) => {
            if (e.target.checked && isRaining) isRaining.checked = false;
        });
    }
}

function setupTabSwitching() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            
            // Update active tab button
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update active content
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            const activeTab = document.getElementById(`${tabId}Tab`);
            if (activeTab) activeTab.classList.add('active');
        });
    });
}

// Handle world folder selection
async function handleWorldFolderSelect(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    showLoading(true);
    
    try {
        // Find level.dat
        const levelDat = files.find(f => f.name === 'level.dat');
        const levelNameFile = files.find(f => f.name === 'levelname.txt');
        const worldIcon = files.find(f => f.name === 'world_icon.jpeg');
        
        if (!levelDat) {
            alert('Invalid world folder: level.dat not found');
            return;
        }
        
        // Store files
        worldFiles = {};
        files.forEach(file => {
            const path = file.webkitRelativePath || file.name;
            worldFiles[path] = file;
        });
        
        // Read level.dat
        const levelData = await readLevelDat(levelDat);
        
        // Read world name
        let worldName = 'Unknown World';
        if (levelNameFile) {
            worldName = await readFileAsText(levelNameFile);
        }
        
        // Create world object
        currentWorld = {
            name: worldName.trim(),
            files: worldFiles,
            levelData: levelData,
            icon: worldIcon ? URL.createObjectURL(worldIcon) : null,
            originalLevelData: JSON.parse(JSON.stringify(levelData))
        };
        
        originalData = JSON.parse(JSON.stringify(levelData));
        
        // Update UI
        updateWorldInfo();
        showEditorUI();
        
    } catch (error) {
        console.error('Error loading world:', error);
        alert('Error loading world: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Handle .mcworld file import
async function handleMcworldSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    showLoading(true);
    
    try {
        const JSZip = window.JSZip;
        const zip = await JSZip.loadAsync(file);
        
        // Find level.dat in zip
        const levelDatFile = Object.keys(zip.files).find(f => f.endsWith('level.dat'));
        if (!levelDatFile) {
            throw new Error('Invalid .mcworld file: level.dat not found');
        }
        
        // Extract all files
        const files = {};
        for (const [path, zipEntry] of Object.entries(zip.files)) {
            if (!zipEntry.dir) {
                const blob = await zipEntry.async('blob');
                files[path] = new File([blob], path.split('/').pop(), { type: blob.type });
            }
        }
        
        // Find level.dat
        const levelDatBlob = await zip.file(levelDatFile).async('blob');
        const levelDatFileObj = new File([levelDatBlob], 'level.dat');
        
        // Find world name
        const levelNameFile = Object.keys(zip.files).find(f => f.endsWith('levelname.txt'));
        let worldName = 'Unknown World';
        if (levelNameFile) {
            const nameBlob = await zip.file(levelNameFile).async('blob');
            worldName = await nameBlob.text();
        }
        
        // Find world icon
        const worldIconFile = Object.keys(zip.files).find(f => f.endsWith('world_icon.jpeg'));
        let iconUrl = null;
        if (worldIconFile) {
            const iconBlob = await zip.file(worldIconFile).async('blob');
            iconUrl = URL.createObjectURL(iconBlob);
        }
        
        // Read level.dat
        const levelData = await readLevelDat(levelDatFileObj);
        
        currentWorld = {
            name: worldName.trim(),
            files: files,
            levelData: levelData,
            icon: iconUrl,
            originalLevelData: JSON.parse(JSON.stringify(levelData)),
            isMcworld: true,
            mcworldFile: file
        };
        
        originalData = JSON.parse(JSON.stringify(levelData));
        
        updateWorldInfo();
        showEditorUI();
        
    } catch (error) {
        console.error('Error loading .mcworld:', error);
        alert('Error loading .mcworld file: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Read level.dat file
async function readLevelDat(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const buffer = e.target.result;
                const arrayBuffer = buffer.slice(0, buffer.byteLength);
                
                // Parse using nbt library
                const nbt = window.prismarineNbt;
                const result = await nbt.parse(arrayBuffer);
                
                // Extract level data
                const levelData = result.value.value.value;
                
                resolve({
                    levelName: levelData?.LevelName?.value || 'Unknown',
                    randomSeed: levelData?.RandomSeed?.value || 0,
                    gameType: levelData?.GameType?.value || 0,
                    difficulty: levelData?.Difficulty?.value || 2,
                    time: levelData?.Time?.value || 0,
                    dayTime: levelData?.DayTime?.value || 0,
                    raining: levelData?.raining?.value === 1,
                    rainTime: levelData?.rainTime?.value || 0,
                    thundering: levelData?.thundering?.value === 1,
                    thunderTime: levelData?.thunderTime?.value || 0,
                    allowCommands: levelData?.allowCommands?.value === 1,
                    commandsEnabled: levelData?.commandsEnabled?.value === 1,
                    hardcore: levelData?.hardcore?.value === 1,
                    hasBeenLoadedInCreative: levelData?.hasBeenLoadedInCreative?.value === 1,
                    clearWeatherTime: levelData?.clearWeatherTime?.value || 0,
                    lastPlayed: levelData?.LastPlayed?.value || Date.now(),
                    sizeOnDisk: levelData?.SizeOnDisk?.value || 0,
                    spawnX: levelData?.SpawnX?.value || 0,
                    spawnY: levelData?.SpawnY?.value || 64,
                    spawnZ: levelData?.SpawnZ?.value || 0,
                    // Player data
                    playerX: levelData?.Player?.value?.Pos?.value?.value?.[0]?.value || 0,
                    playerY: levelData?.Player?.value?.Pos?.value?.value?.[1]?.value || 64,
                    playerZ: levelData?.Player?.value?.Pos?.value?.value?.[2]?.value || 0,
                    playerHealth: levelData?.Player?.value?.Health?.value || 20,
                    playerHunger: levelData?.Player?.value?.Hunger?.value || 20,
                    playerXpLevel: levelData?.Player?.value?.XpLevel?.value || 0,
                    playerXpPoints: levelData?.Player?.value?.XpP?.value || 0,
                    abilities: {
                        mayFly: levelData?.Player?.value?.Abilities?.value?.mayfly?.value === 1,
                        flying: levelData?.Player?.value?.Abilities?.value?.flying?.value === 1,
                        invulnerable: levelData?.Player?.value?.Abilities?.value?.invulnerable?.value === 1,
                        instantBuild: levelData?.Player?.value?.Abilities?.value?.instabuild?.value === 1
                    }
                });
                
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

// Update world info display
function updateWorldInfo() {
    if (!currentWorld) return;
    
    const worldNameInput = document.getElementById('worldName');
    const worldSeedSpan = document.getElementById('worldSeed');
    const gameModeSelect = document.getElementById('gameMode');
    const difficultySelect = document.getElementById('difficulty');
    const worldSizeSpan = document.getElementById('worldSize');
    const lastPlayedSpan = document.getElementById('lastPlayed');
    const thumbnailImg = document.getElementById('thumbnailImg');
    const worldThumbnail = document.getElementById('worldThumbnail');
    
    if (worldNameInput) worldNameInput.value = currentWorld.name;
    if (worldSeedSpan) worldSeedSpan.innerText = currentWorld.levelData.randomSeed;
    if (gameModeSelect) gameModeSelect.value = currentWorld.levelData.gameType;
    if (difficultySelect) difficultySelect.value = currentWorld.levelData.difficulty;
    if (worldSizeSpan) worldSizeSpan.innerText = formatFileSize(currentWorld.levelData.sizeOnDisk);
    if (lastPlayedSpan) lastPlayedSpan.innerText = new Date(currentWorld.levelData.lastPlayed).toLocaleString();
    
    // Set thumbnail
    if (currentWorld.icon && thumbnailImg && worldThumbnail) {
        thumbnailImg.src = currentWorld.icon;
        worldThumbnail.style.display = 'block';
    }
    
    // Populate editor fields
    populateEditorFields();
}

function populateEditorFields() {
    if (!currentWorld) return;
    const data = currentWorld.levelData;
    
    // Game settings
    const defaultGameMode = document.getElementById('defaultGameMode');
    const hardcoreMode = document.getElementById('hardcoreMode');
    const commandsEnabled = document.getElementById('commandsEnabled');
    const hasBeenCreative = document.getElementById('hasBeenCreative');
    
    if (defaultGameMode) defaultGameMode.value = data.gameType;
    if (hardcoreMode) hardcoreMode.checked = data.hardcore;
    if (commandsEnabled) commandsEnabled.checked = data.commandsEnabled;
    if (hasBeenCreative) hasBeenCreative.checked = data.hasBeenLoadedInCreative;
    
    // Time & Weather
    const worldTime = document.getElementById('worldTime');
    const timeSlider = document.getElementById('timeSlider');
    const isRaining = document.getElementById('isRaining');
    const isThundering = document.getElementById('isThundering');
    const rainTime = document.getElementById('rainTime');
    const clearWeatherTime = document.getElementById('clearWeatherTime');
    
    if (worldTime) worldTime.value = data.time;
    if (timeSlider) timeSlider.value = data.time;
    if (isRaining) isRaining.checked = data.raining;
    if (isThundering) isThundering.checked = data.thundering;
    if (rainTime) rainTime.value = data.rainTime;
    if (clearWeatherTime) clearWeatherTime.value = data.clearWeatherTime;
    
    // Game Rules
    const ruleAllowCheats = document.getElementById('ruleAllowCheats');
    const ruleAllowFlight = document.getElementById('ruleAllowFlight');
    if (ruleAllowCheats) ruleAllowCheats.checked = data.allowCommands;
    if (ruleAllowFlight) ruleAllowFlight.checked = data.abilities?.mayFly || false;
    
    // Player data
    const playerX = document.getElementById('playerX');
    const playerY = document.getElementById('playerY');
    const playerZ = document.getElementById('playerZ');
    const playerHealth = document.getElementById('playerHealth');
    const playerHunger = document.getElementById('playerHunger');
    const playerXpLevel = document.getElementById('playerXpLevel');
    const playerXpPoints = document.getElementById('playerXpPoints');
    const abilityMayFly = document.getElementById('abilityMayFly');
    const abilityFlying = document.getElementById('abilityFlying');
    const abilityInvulnerable = document.getElementById('abilityInvulnerable');
    const abilityInstantBuild = document.getElementById('abilityInstantBuild');
    
    if (playerX) playerX.value = data.playerX;
    if (playerY) playerY.value = data.playerY;
    if (playerZ) playerZ.value = data.playerZ;
    if (playerHealth) playerHealth.value = data.playerHealth;
    if (playerHunger) playerHunger.value = data.playerHunger;
    if (playerXpLevel) playerXpLevel.value = data.playerXpLevel;
    if (playerXpPoints) playerXpPoints.value = data.playerXpPoints;
    if (abilityMayFly) abilityMayFly.checked = data.abilities?.mayFly || false;
    if (abilityFlying) abilityFlying.checked = data.abilities?.flying || false;
    if (abilityInvulnerable) abilityInvulnerable.checked = data.abilities?.invulnerable || false;
    if (abilityInstantBuild) abilityInstantBuild.checked = data.abilities?.instantBuild || false;
}

// Apply changes to world data
function applyChanges() {
    if (!currentWorld) return;
    
    // Gather all changes
    const updatedData = {
        ...currentWorld.levelData,
        levelName: document.getElementById('worldName')?.value || currentWorld.name,
        gameType: parseInt(document.getElementById('gameMode')?.value || 0),
        difficulty: parseInt(document.getElementById('difficulty')?.value || 2),
        time: parseInt(document.getElementById('worldTime')?.value || 0),
        raining: document.getElementById('isRaining')?.checked || false,
        rainTime: parseInt(document.getElementById('rainTime')?.value || 0),
        thundering: document.getElementById('isThundering')?.checked || false,
        thunderTime: document.getElementById('isThundering')?.checked ? 12000 : 0,
        allowCommands: document.getElementById('ruleAllowCheats')?.checked || false,
        commandsEnabled: document.getElementById('commandsEnabled')?.checked || false,
        hardcore: document.getElementById('hardcoreMode')?.checked || false,
        hasBeenLoadedInCreative: document.getElementById('hasBeenCreative')?.checked || false,
        clearWeatherTime: parseInt(document.getElementById('clearWeatherTime')?.value || 0),
        playerX: parseFloat(document.getElementById('playerX')?.value || 0),
        playerY: parseFloat(document.getElementById('playerY')?.value || 64),
        playerZ: parseFloat(document.getElementById('playerZ')?.value || 0),
        playerHealth: parseInt(document.getElementById('playerHealth')?.value || 20),
        playerHunger: parseInt(document.getElementById('playerHunger')?.value || 20),
        playerXpLevel: parseInt(document.getElementById('playerXpLevel')?.value || 0),
        playerXpPoints: parseInt(document.getElementById('playerXpPoints')?.value || 0),
        abilities: {
            mayFly: document.getElementById('abilityMayFly')?.checked || false,
            flying: document.getElementById('abilityFlying')?.checked || false,
            invulnerable: document.getElementById('abilityInvulnerable')?.checked || false,
            instantBuild: document.getElementById('abilityInstantBuild')?.checked || false
        }
    };
    
    // Update world data
    currentWorld.levelData = updatedData;
    currentWorld.name = updatedData.levelName;
    
    // Show success message
    showToast('Changes applied successfully! Export your world to save changes.');
}

function resetChanges() {
    if (!originalData) return;
    currentWorld.levelData = JSON.parse(JSON.stringify(originalData));
    populateEditorFields();
    updateWorldInfo();
    showToast('Changes reset to original state.');
}

// Global functions for HTML buttons
window.setTime = function(ticks) {
    const worldTime = document.getElementById('worldTime');
    const timeSlider = document.getElementById('timeSlider');
    if (worldTime) worldTime.value = ticks;
    if (timeSlider) timeSlider.value = ticks;
};

window.setWeather = function(type) {
    const isRaining = document.getElementById('isRaining');
    const isThundering = document.getElementById('isThundering');
    
    if (!isRaining || !isThundering) return;
    
    switch(type) {
        case 'clear':
            isRaining.checked = false;
            isThundering.checked = false;
            break;
        case 'rain':
            isRaining.checked = true;
            isThundering.checked = false;
            break;
        case 'thunder':
            isRaining.checked = true;
            isThundering.checked = true;
            break;
    }
};

window.resetToSpawn = function() {
    if (!currentWorld) return;
    const playerX = document.getElementById('playerX');
    const playerY = document.getElementById('playerY');
    const playerZ = document.getElementById('playerZ');
    
    if (playerX) playerX.value = currentWorld.levelData.spawnX;
    if (playerY) playerY.value = currentWorld.levelData.spawnY;
    if (playerZ) playerZ.value = currentWorld.levelData.spawnZ;
};

window.copyToClipboard = function(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        const text = element.innerText;
        navigator.clipboard.writeText(text);
        showToast('Copied to clipboard!');
    }
};

async function exportWorld() {
    if (!currentWorld) return;
    
    showLoading(true);
    
    try {
        const JSZip = window.JSZip;
        const zip = new JSZip();
        
        // Create modified level.dat
        const modifiedLevelDat = await createModifiedLevelDat();
        
        // Add level.dat to zip
        zip.file('level.dat', modifiedLevelDat);
        
        // Add all other files
        for (const [path, file] of Object.entries(currentWorld.files)) {
            if (path !== 'level.dat' && file) {
                const blob = await file.arrayBuffer();
                zip.file(path, blob);
            }
        }
        
        // Add updated levelname.txt
        zip.file('levelname.txt', currentWorld.name);
        
        // Generate zip file
        const content = await zip.generateAsync({ type: 'blob' });
        
        // Download
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentWorld.name.replace(/[^a-z0-9]/gi, '_')}.mcworld`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('World exported successfully!');
        
    } catch (error) {
        console.error('Export error:', error);
        alert('Error exporting world: ' + error.message);
    } finally {
        showLoading(false);
    }
}

async function createModifiedLevelDat() {
    const nbt = window.prismarineNbt;
    const data = currentWorld.levelData;
    
    // Create NBT structure
    const nbtData = {
        type: 'compound',
        name: '',
        value: {
            Data: {
                type: 'compound',
                value: {
                    LevelName: { type: 'string', value: data.levelName },
                    RandomSeed: { type: 'long', value: data.randomSeed },
                    GameType: { type: 'int', value: data.gameType },
                    Difficulty: { type: 'int', value: data.difficulty },
                    Time: { type: 'long', value: data.time },
                    DayTime: { type: 'long', value: data.dayTime || data.time },
                    raining: { type: 'byte', value: data.raining ? 1 : 0 },
                    rainTime: { type: 'int', value: data.rainTime },
                    thundering: { type: 'byte', value: data.thundering ? 1 : 0 },
                    thunderTime: { type: 'int', value: data.thunderTime || 0 },
                    allowCommands: { type: 'byte', value: data.allowCommands ? 1 : 0 },
                    commandsEnabled: { type: 'byte', value: data.commandsEnabled ? 1 : 0 },
                    hardcore: { type: 'byte', value: data.hardcore ? 1 : 0 },
                    hasBeenLoadedInCreative: { type: 'byte', value: data.hasBeenLoadedInCreative ? 1 : 0 },
                    clearWeatherTime: { type: 'int', value: data.clearWeatherTime },
                    LastPlayed: { type: 'long', value: Date.now() },
                    SpawnX: { type: 'int', value: data.spawnX },
                    SpawnY: { type: 'int', value: data.spawnY },
                    SpawnZ: { type: 'int', value: data.spawnZ },
                    Player: {
                        type: 'compound',
                        value: {
                            Pos: {
                                type: 'list',
                                value: {
                                    type: 'double',
                                    value: [
                                        { type: 'double', value: data.playerX },
                                        { type: 'double', value: data.playerY },
                                        { type: 'double', value: data.playerZ }
                                    ]
                                }
                            },
                            Health: { type: 'int', value: data.playerHealth },
                            Hunger: { type: 'int', value: data.playerHunger },
                            XpLevel: { type: 'int', value: data.playerXpLevel },
                            XpP: { type: 'float', value: data.playerXpPoints },
                            Abilities: {
                                type: 'compound',
                                value: {
                                    mayfly: { type: 'byte', value: data.abilities?.mayFly ? 1 : 0 },
                                    flying: { type: 'byte', value: data.abilities?.flying ? 1 : 0 },
                                    invulnerable: { type: 'byte', value: data.abilities?.invulnerable ? 1 : 0 },
                                    instabuild: { type: 'byte', value: data.abilities?.instantBuild ? 1 : 0 }
                                }
                            }
                        }
                    }
                }
            }
        }
    };
    
    // Write NBT
    const buffer = await nbt.write(nbtData);
    return buffer;
}

// UI Helper Functions
function showEditorUI() {
    const importSection = document.getElementById('importSection');
    const worldInfoSection = document.getElementById('worldInfoSection');
    const editorTabs = document.getElementById('editorTabs');
    const actionButtons = document.getElementById('actionButtons');
    
    if (importSection) importSection.style.display = 'none';
    if (worldInfoSection) worldInfoSection.style.display = 'block';
    if (editorTabs) editorTabs.style.display = 'block';
    if (actionButtons) actionButtons.style.display = 'flex';
}

function resetToImport() {
    const importSection = document.getElementById('importSection');
    const worldInfoSection = document.getElementById('worldInfoSection');
    const editorTabs = document.getElementById('editorTabs');
    const actionButtons = document.getElementById('actionButtons');
    
    if (importSection) importSection.style.display = 'block';
    if (worldInfoSection) worldInfoSection.style.display = 'none';
    if (editorTabs) editorTabs.style.display = 'none';
    if (actionButtons) actionButtons.style.display = 'none';
    
    // Reset file inputs
    if (fileInput) fileInput.value = '';
    if (mcworldInput) mcworldInput.value = '';
    
    // Clear world data
    currentWorld = null;
    worldFiles = {};
}

function showLoading(show) {
    if (loadingOverlay) {
        loadingOverlay.style.display = show ? 'flex' : 'none';
    }
}

function showToast(message) {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #66bb6a;
        color: white;
        padding: 12px 24px;
        border-radius: 12px;
        z-index: 1000;
        animation: slideIn 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        font-family: 'Inter', sans-serif;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
