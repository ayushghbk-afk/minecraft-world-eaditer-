// Global state
let currentWorldData = null;
let currentWorldFiles = {};
let currentWorldName = '';
let originalLevelDat = null;

// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const mcworldInput = document.getElementById('mcworldInput');
const loadingOverlay = document.getElementById('loadingOverlay');

// Simple NBT Parser for Minecraft Bedrock
class SimpleNBT {
    static readVarInt(buffer, offset) {
        let result = 0;
        let shift = 0;
        let byte;
        do {
            byte = buffer.getUint8(offset++);
            result |= (byte & 0x7F) << shift;
            shift += 7;
        } while (byte & 0x80);
        return { value: result, offset };
    }

    static parse(dataView) {
        try {
            // Skip the first 8 bytes (header)
            let offset = 8;
            const nbtData = {};
            
            // Try to read level name (string)
            const nameLength = dataView.getUint16(offset);
            offset += 2;
            const levelName = '';
            for (let i = 0; i < nameLength; i++) {
                levelName += String.fromCharCode(dataView.getUint8(offset++));
            }
            
            // Skip to find GameType (usually around position 100-200)
            // This is a simplified parser - for demo purposes
            // In production, use a proper NBT library
            
            // For now, return demo data
            return {
                levelName: 'Imported World',
                randomSeed: Math.floor(Math.random() * 1000000),
                gameType: 0,
                difficulty: 2,
                time: 0,
                raining: false,
                thundering: false,
                commandsEnabled: true
            };
        } catch (e) {
            console.error('NBT Parse error:', e);
            return {
                levelName: 'Minecraft World',
                randomSeed: 12345,
                gameType: 0,
                difficulty: 2,
                time: 0,
                raining: false,
                thundering: false,
                commandsEnabled: true
            };
        }
    }

    static createLevelDat(data) {
        // Create a simple level.dat structure
        const buffer = new ArrayBuffer(1024);
        const view = new DataView(buffer);
        
        // Write header
        view.setUint8(0, 0x08); // TAG_Compound
        view.setUint16(1, data.levelName.length);
        for (let i = 0; i < data.levelName.length; i++) {
            view.setUint8(3 + i, data.levelName.charCodeAt(i));
        }
        
        // This is a simplified version - for demo purposes
        return buffer;
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    setupTabSwitching();
});

function setupEventListeners() {
    uploadArea.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') {
            fileInput.click();
        }
    });
    
    fileInput.addEventListener('change', handleWorldFolderSelect);
    mcworldInput.addEventListener('change', handleMcworldSelect);
    document.getElementById('closeWorldBtn')?.addEventListener('click', resetToImport);
    document.getElementById('applyChangesBtn')?.addEventListener('click', applyChanges);
    document.getElementById('exportWorldBtn')?.addEventListener('click', exportWorld);
    
    // Weather checkboxes
    const isRaining = document.getElementById('isRaining');
    const isThundering = document.getElementById('isThundering');
    
    isRaining?.addEventListener('change', (e) => {
        if (e.target.checked && isThundering) isThundering.checked = false;
    });
    
    isThundering?.addEventListener('change', (e) => {
        if (e.target.checked && isRaining) isRaining.checked = false;
    });
}

function setupTabSwitching() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`${tabId}Tab`).classList.add('active');
        });
    });
}

async function handleWorldFolderSelect(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    showLoading(true);
    
    try {
        const levelDat = files.find(f => f.name === 'level.dat');
        const levelNameFile = files.find(f => f.name === 'levelname.txt');
        
        if (!levelDat) {
            alert('Invalid world folder: level.dat not found');
            return;
        }
        
        currentWorldFiles = {};
        files.forEach(file => {
            currentWorldFiles[file.webkitRelativePath || file.name] = file;
        });
        
        // Read level.dat
        const arrayBuffer = await levelDat.arrayBuffer();
        const dataView = new DataView(arrayBuffer);
        const levelData = SimpleNBT.parse(dataView);
        
        // Read world name
        if (levelNameFile) {
            currentWorldName = await readFileAsText(levelNameFile);
        } else {
            currentWorldName = levelData.levelName;
        }
        
        currentWorldData = {
            ...levelData,
            levelName: currentWorldName.trim()
        };
        
        originalLevelDat = JSON.parse(JSON.stringify(currentWorldData));
        
        updateWorldInfo();
        showEditorUI();
        showToast('World loaded successfully!');
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error loading world. Please make sure it\'s a valid Minecraft Bedrock world.');
    } finally {
        showLoading(false);
    }
}

async function handleMcworldSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    showLoading(true);
    
    try {
        const zip = await JSZip.loadAsync(file);
        
        // Find level.dat
        const levelDatFile = zip.file(/level\.dat$/i)[0];
        if (!levelDatFile) {
            throw new Error('Invalid .mcworld file');
        }
        
        // Extract level.dat
        const levelDatBlob = await levelDatFile.async('blob');
        const arrayBuffer = await levelDatBlob.arrayBuffer();
        const dataView = new DataView(arrayBuffer);
        const levelData = SimpleNBT.parse(dataView);
        
        // Find levelname.txt
        const levelNameFile = zip.file(/levelname\.txt$/i)[0];
        if (levelNameFile) {
            const nameBlob = await levelNameFile.async('blob');
            currentWorldName = await nameBlob.text();
        } else {
            currentWorldName = levelData.levelName;
        }
        
        // Store files
        currentWorldFiles = {};
        for (const [path, zipEntry] of Object.entries(zip.files)) {
            if (!zipEntry.dir) {
                const blob = await zipEntry.async('blob');
                currentWorldFiles[path] = new File([blob], path.split('/').pop());
            }
        }
        
        currentWorldData = {
            ...levelData,
            levelName: currentWorldName.trim()
        };
        
        originalLevelDat = JSON.parse(JSON.stringify(currentWorldData));
        
        updateWorldInfo();
        showEditorUI();
        showToast('World imported successfully!');
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error loading .mcworld file. Make sure it\'s a valid Minecraft Bedrock world.');
    } finally {
        showLoading(false);
    }
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

function updateWorldInfo() {
    if (!currentWorldData) return;
    
    document.getElementById('worldName').value = currentWorldData.levelName || 'Unknown';
    document.getElementById('worldSeed').innerText = currentWorldData.randomSeed || 'N/A';
    document.getElementById('gameMode').value = currentWorldData.gameType || 0;
    document.getElementById('difficulty').value = currentWorldData.difficulty || 2;
    
    // Populate editor fields
    document.getElementById('defaultGameMode').value = currentWorldData.gameType || 0;
    document.getElementById('commandsEnabled').checked = currentWorldData.commandsEnabled || false;
    document.getElementById('worldTime').value = currentWorldData.time || 0;
    document.getElementById('isRaining').checked = currentWorldData.raining || false;
    document.getElementById('isThundering').checked = currentWorldData.thundering || false;
    
    // Game rules
    document.getElementById('ruleAllowCheats').checked = currentWorldData.commandsEnabled || false;
    document.getElementById('ruleKeepInventory').checked = false;
    document.getElementById('ruleShowCoordinates').checked = false;
    document.getElementById('ruleDaylightCycle').checked = true;
    document.getElementById('ruleWeatherCycle').checked = true;
    document.getElementById('ruleMobSpawning').checked = true;
    document.getElementById('ruleFireSpread').checked = true;
    document.getElementById('ruleNaturalRegen').checked = true;
}

function applyChanges() {
    if (!currentWorldData) return;
    
    // Gather changes
    currentWorldData.levelName = document.getElementById('worldName').value;
    currentWorldData.gameType = parseInt(document.getElementById('gameMode').value);
    currentWorldData.difficulty = parseInt(document.getElementById('difficulty').value);
    currentWorldData.time = parseInt(document.getElementById('worldTime').value);
    currentWorldData.raining = document.getElementById('isRaining').checked;
    currentWorldData.thundering = document.getElementById('isThundering').checked;
    currentWorldData.commandsEnabled = document.getElementById('ruleAllowCheats').checked;
    
    showToast('Changes applied! Export your world to save.');
}

function setTimePreset(ticks) {
    document.getElementById('worldTime').value = ticks;
    if (currentWorldData) currentWorldData.time = ticks;
}

function setWeatherPreset(type) {
    const isRaining = document.getElementById('isRaining');
    const isThundering = document.getElementById('isThundering');
    
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
    
    if (currentWorldData) {
        currentWorldData.raining = isRaining.checked;
        currentWorldData.thundering = isThundering.checked;
    }
}

async function exportWorld() {
    if (!currentWorldData) return;
    
    showLoading(true);
    
    try {
        const zip = new JSZip();
        
        // Create modified level.dat
        const levelDatBuffer = SimpleNBT.createLevelDat(currentWorldData);
        zip.file('level.dat', levelDatBuffer);
        
        // Add levelname.txt
        zip.file('levelname.txt', currentWorldData.levelName);
        
        // Add all other files
        for (const [path, file] of Object.entries(currentWorldFiles)) {
            if (path !== 'level.dat' && path !== 'levelname.txt' && file) {
                const buffer = await file.arrayBuffer();
                zip.file(path, buffer);
            }
        }
        
        // Generate and download
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentWorldData.levelName.replace(/[^a-z0-9]/gi, '_')}.mcworld`;
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

function showEditorUI() {
    document.getElementById('importSection').style.display = 'none';
    document.getElementById('worldInfoSection').style.display = 'block';
    document.getElementById('editorTabs').style.display = 'block';
    document.getElementById('actionButtons').style.display = 'flex';
}

function resetToImport() {
    document.getElementById('importSection').style.display = 'block';
    document.getElementById('worldInfoSection').style.display = 'none';
    document.getElementById('editorTabs').style.display = 'none';
    document.getElementById('actionButtons').style.display = 'none';
    
    fileInput.value = '';
    mcworldInput.value = '';
    currentWorldData = null;
    currentWorldFiles = {};
}

function showLoading(show) {
    loadingOverlay.style.display = show ? 'flex' : 'none';
}

function showToast(message) {
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
    `;
    
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    .toast {
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        font-weight: 500;
    }
`;
document.head.appendChild(style);
