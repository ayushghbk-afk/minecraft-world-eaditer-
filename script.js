// ==================== GLOBAL STATE ====================
let currentWorld = null;
let worldData = {};
let worldFiles = {};
let history = [];
let historyIndex = -1;
let currentTool = 'place';
let currentBlock = 'stone';
let brushSize = 1;
let brushShape = 'cube';
let selectedArea = null;
let clipboard = null;
let viewMode = '3d';
let camera = { x: 0, y: 64, z: 0, rotX: 45, rotY: 30 };
let mouseDown = false;
let lastMouseX = 0, lastMouseY = 0;

// Block Types with colors and emojis
const BLOCKS = {
    air: { id: 0, name: 'Air', emoji: '⬜', color: '#808080', transparent: true },
    stone: { id: 1, name: 'Stone', emoji: '🪨', color: '#808080' },
    dirt: { id: 2, name: 'Dirt', emoji: '🟫', color: '#8B5A2B' },
    grass: { id: 3, name: 'Grass', emoji: '🟢', color: '#5C9E5C' },
    wood: { id: 4, name: 'Wood', emoji: '🪵', color: '#8B5A2B' },
    cobblestone: { id: 5, name: 'Cobblestone', emoji: '🪨', color: '#696969' },
    sand: { id: 6, name: 'Sand', emoji: '🟨', color: '#F4E542' },
    water: { id: 7, name: 'Water', emoji: '💧', color: '#3B6E9E' },
    lava: { id: 8, name: 'Lava', emoji: '🌋', color: '#FF4500' },
    gold: { id: 9, name: 'Gold', emoji: '🪙', color: '#FFD700' },
    diamond: { id: 10, name: 'Diamond', emoji: '💎', color: '#4AE8E8' },
    iron: { id: 11, name: 'Iron', emoji: '⚙️', color: '#C0C0C0' },
    emerald: { id: 12, name: 'Emerald', emoji: '🟢', color: '#50C878' },
    redstone: { id: 13, name: 'Redstone', emoji: '🔴', color: '#FF4444' },
    lapis: { id: 14, name: 'Lapis', emoji: '🔵', color: '#2663C9' },
    obsidian: { id: 15, name: 'Obsidian', emoji: '⚫', color: '#2D2D2D' },
    brick: { id: 16, name: 'Brick', emoji: '🧱', color: '#B5623B' },
    glass: { id: 17, name: 'Glass', emoji: '🔲', color: '#A9F5F5' },
    leaves: { id: 18, name: 'Leaves', emoji: '🍃', color: '#3A9E3A' },
    tnt: { id: 19, name: 'TNT', emoji: '💣', color: '#FF4444' }
};

const BLOCK_LIST = Object.entries(BLOCKS).filter(([key]) => key !== 'air');

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    initBlockPalette();
    initCanvas();
    initWorld();
});

function initEventListeners() {
    // File inputs
    document.getElementById('fileInput')?.addEventListener('change', handleWorldFolderSelect);
    document.getElementById('mcworldInput')?.addEventListener('change', handleMcworldSelect);
    
    // Viewport tabs
    document.querySelectorAll('.viewport-btn').forEach(btn => {
        btn.addEventListener('click', () => switchViewMode(btn.dataset.view));
    });
    
    // Tool buttons
    document.querySelectorAll('[data-tool]').forEach(btn => {
        btn.addEventListener('click', () => setCurrentTool(btn.dataset.tool));
    });
    
    // Brush settings
    const brushSizeInput = document.getElementById('brushSize');
    brushSizeInput?.addEventListener('input', (e) => {
        brushSize = parseInt(e.target.value);
        document.getElementById('brushSizeValue').innerText = brushSize;
    });
    
    document.getElementById('brushShape')?.addEventListener('change', (e) => {
        brushShape = e.target.value;
    });
    
    // Action buttons
    document.getElementById('selectAreaBtn')?.addEventListener('click', () => startAreaSelection());
    document.getElementById('fillAreaBtn')?.addEventListener('click', () => fillSelectedArea());
    document.getElementById('copyAreaBtn')?.addEventListener('click', () => copySelectedArea());
    document.getElementById('pasteAreaBtn')?.addEventListener('click', () => pasteArea());
    document.getElementById('clearAreaBtn')?.addEventListener('click', () => clearSelectedArea());
    document.getElementById('smoothTerrainBtn')?.addEventListener('click', () => smoothTerrain());
    document.getElementById('generateTreesBtn')?.addEventListener('click', () => generateTrees());
    document.getElementById('generateOresBtn')?.addEventListener('click', () => generateOres());
    document.getElementById('saveWorldBtn')?.addEventListener('click', () => saveWorld());
    document.getElementById('exportWorldBtn')?.addEventListener('click', () => exportWorld());
    document.getElementById('undoBtn')?.addEventListener('click', () => undo());
    document.getElementById('redoBtn')?.addEventListener('click', () => redo());
}

function initBlockPalette() {
    const palette = document.getElementById('blockPalette');
    if (!palette) return;
    
    palette.innerHTML = '';
    Object.entries(BLOCKS).forEach(([key, block]) => {
        if (key !== 'air') {
            const blockDiv = document.createElement('div');
            blockDiv.className = 'block-item';
            blockDiv.style.background = block.color;
            blockDiv.style.opacity = block.transparent ? '0.7' : '1';
            blockDiv.innerHTML = `<span style="font-size: 24px;">${block.emoji}</span>`;
            blockDiv.title = block.name;
            blockDiv.onclick = () => setCurrentBlock(key);
            if (currentBlock === key) blockDiv.classList.add('selected');
            palette.appendChild(blockDiv);
        }
    });
}

function setCurrentBlock(blockId) {
    currentBlock = blockId;
    document.querySelectorAll('.block-item').forEach((item, i) => {
        if (i === Object.keys(BLOCKS).filter(k => k !== 'air').indexOf(blockId)) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
    showToast(`Selected: ${BLOCKS[blockId].name}`);
}

function setCurrentTool(tool) {
    currentTool = tool;
    document.querySelectorAll('[data-tool]').forEach(btn => {
        if (btn.dataset.tool === tool) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    showToast(`Tool: ${tool === 'place' ? 'Place Block' : tool === 'remove' ? 'Remove Block' : tool === 'replace' ? 'Replace' : 'Paint Mode'}`);
}

function switchViewMode(mode) {
    viewMode = mode;
    document.querySelectorAll('.viewport-btn').forEach(btn => {
        if (btn.dataset.view === mode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    const canvas = document.getElementById('worldCanvas');
    const miniMapDiv = document.getElementById('2dView');
    
    if (mode === '2d' || mode === 'top' || mode === 'side') {
        canvas.style.display = 'none';
        miniMapDiv.style.display = 'block';
        render2DView();
    } else {
        canvas.style.display = 'block';
        miniMapDiv.style.display = 'none';
        render3DView();
    }
}

// ==================== WORLD MANAGEMENT ====================
function initWorld() {
    // Create a default 50x50x50 world
    worldData = {};
    for (let x = -25; x < 25; x++) {
        for (let z = -25; z < 25; z++) {
            // Ground level
            setBlock(x, 60, z, 'grass');
            // Dirt layer
            setBlock(x, 59, z, 'dirt');
            setBlock(x, 58, z, 'dirt');
            // Stone base
            for (let y = 55; y < 58; y++) {
                setBlock(x, y, z, 'stone');
            }
            // Add some hills
            const height = Math.sin(x * 0.3) * Math.cos(z * 0.3) * 3;
            if (height > 0) {
                for (let h = 1; h <= height; h++) {
                    setBlock(x, 60 + h, z, 'grass');
                }
            }
        }
    }
    
    // Add some trees
    for (let i = 0; i < 10; i++) {
        const x = Math.floor(Math.random() * 40) - 20;
        const z = Math.floor(Math.random() * 40) - 20;
        generateTree(x, 61, z);
    }
    
    updateWorldStats();
    saveToHistory();
}

function setBlock(x, y, z, blockType) {
    const key = `${x},${y},${z}`;
    if (blockType === 'air' || blockType === null) {
        delete worldData[key];
    } else {
        worldData[key] = blockType;
    }
}

function getBlock(x, y, z) {
    const key = `${x},${y},${z}`;
    return worldData[key] || 'air';
}

function handleWorldFolderSelect(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    showLoading(true);
    setTimeout(() => {
        showLoading(false);
        document.getElementById('importSection').style.display = 'none';
        document.getElementById('mainEditor').style.display = 'grid';
        showToast('World loaded successfully!');
        render3DView();
    }, 1000);
}

function handleMcworldSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    showLoading(true);
    setTimeout(() => {
        showLoading(false);
        document.getElementById('importSection').style.display = 'none';
        document.getElementById('mainEditor').style.display = 'grid';
        showToast('.mcworld file loaded successfully!');
        render3DView();
    }, 1000);
}

// ==================== 3D RENDERING ====================
let ctx, canvas, width, height;

function initCanvas() {
    canvas = document.getElementById('worldCanvas');
    if (!canvas) return;
    
    ctx = canvas.getContext('2d');
    width = canvas.width;
    height = canvas.height;
    
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', () => mouseDown = false);
    canvas.addEventListener('wheel', onMouseWheel);
    
    render3DView();
}

function render3DView() {
    if (!ctx || viewMode !== '3d') return;
    
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, width, height);
    
    // Draw blocks
    const blocksToDraw = [];
    for (const [key, blockType] of Object.entries(worldData)) {
        const [x, y, z] = key.split(',').map(Number);
        const screenX = projectX(x, z, y);
        const screenY = projectY(x, z, y);
        
        if (screenX >= -50 && screenX < width + 50 && screenY >= -50 && screenY < height + 50) {
            blocksToDraw.push({ x, y, z, screenX, screenY, blockType });
        }
    }
    
    // Sort by Y for pseudo-3D effect
    blocksToDraw.sort((a, b) => (a.y + a.z) - (b.y + b.z));
    
    blocksToDraw.forEach(block => {
        const blockInfo = BLOCKS[block.blockType];
        const size = 12;
        
        ctx.fillStyle = blockInfo.color;
        ctx.fillRect(block.screenX - size/2, block.screenY - size/2, size, size);
        
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '10px Arial';
        ctx.fillText(blockInfo.emoji, block.screenX - 6, block.screenY + 4);
        
        // Highlight hovered block
        if (isHoveringBlock(block)) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 2;
            ctx.strokeRect(block.screenX - size/2, block.screenY - size/2, size, size);
        }
    });
    
    requestAnimationFrame(() => render3DView());
}

function projectX(x, z, y) {
    const angle = camera.rotY * Math.PI / 180;
    const xRot = x * Math.cos(angle) - z * Math.sin(angle);
    const scale = 300 / (y + 100);
    return width / 2 + xRot * 10;
}

function projectY(x, z, y) {
    const angle = camera.rotX * Math.PI / 180;
    const zRot = x * Math.sin(angle) + z * Math.cos(angle);
    return height / 2 - y * 8 + zRot * 4;
}

function onMouseDown(e) {
    mouseDown = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    handleBlockPlacement(e);
}

function onMouseMove(e) {
    if (mouseDown) {
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        if (e.buttons === 1) {
            // Rotate view
            camera.rotY += dx * 0.5;
            camera.rotX += dy * 0.5;
            camera.rotX = Math.min(89, Math.max(-89, camera.rotX));
        }
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    }
    updateHoverPosition(e);
}

function onMouseWheel(e) {
    e.preventDefault();
    camera.z += e.deltaY * 0.1;
}

function handleBlockPlacement(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Find block under mouse
    for (const [key, blockType] of Object.entries(worldData)) {
        const [x, y, z] = key.split(',').map(Number);
        const screenX = projectX(x, z, y);
        const screenY = projectY(x, z, y);
        const size = 12;
        
        if (Math.abs(mouseX - screenX) < size && Math.abs(mouseY - screenY) < size) {
            if (currentTool === 'place') {
                placeBlockWithBrush(x, y + 1, z);
            } else if (currentTool === 'remove') {
                removeBlock(x, y, z);
            } else if (currentTool === 'replace') {
                setBlock(x, y, z, currentBlock);
            }
            saveToHistory();
            updateWorldStats();
            break;
        }
    }
}

function placeBlockWithBrush(cx, cy, cz) {
    if (brushShape === 'cube') {
        for (let x = cx - brushSize; x <= cx + brushSize; x++) {
            for (let y = cy - brushSize; y <= cy + brushSize; y++) {
                for (let z = cz - brushSize; z <= cz + brushSize; z++) {
                    if (Math.abs(x - cx) <= brushSize && Math.abs(y - cy) <= brushSize && Math.abs(z - cz) <= brushSize) {
                        setBlock(x, y, z, currentBlock);
                    }
                }
            }
        }
    } else if (brushShape === 'sphere') {
        for (let x = cx - brushSize; x <= cx + brushSize; x++) {
            for (let y = cy - brushSize; y <= cy + brushSize; y++) {
                for (let z = cz - brushSize; z <= cz + brushSize; z++) {
                    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2);
                    if (dist <= brushSize) {
                        setBlock(x, y, z, currentBlock);
                    }
                }
            }
        }
    }
}

function removeBlock(x, y, z) {
    setBlock(x, y, z, 'air');
}

// ==================== 2D RENDERING ====================
function render2DView() {
    const miniMap = document.getElementById('miniMap');
    if (!miniMap) return;
    
    const size = 400;
    const cellSize = size / 50;
    
    miniMap.innerHTML = `<canvas id="miniMapCanvas" width="${size}" height="${size}" style="background: #1a1a2a; border-radius: 8px;"></canvas>`;
    const mapCtx = document.getElementById('miniMapCanvas')?.getContext('2d');
    if (!mapCtx) return;
    
    for (let x = -25; x < 25; x++) {
        for (let z = -25; z < 25; z++) {
            let highestBlock = 'air';
            for (let y = 70; y >= 55; y--) {
                const block = getBlock(x, y, z);
                if (block !== 'air') {
                    highestBlock = block;
                    break;
                }
            }
            
            const blockInfo = BLOCKS[highestBlock];
            const screenX = (x + 25) * cellSize;
            const screenY = (z + 25) * cellSize;
            
            mapCtx.fillStyle = blockInfo.color;
            mapCtx.fillRect(screenX, screenY, cellSize - 1, cellSize - 1);
            
            mapCtx.fillStyle = '#FFF';
            mapCtx.font = `${cellSize * 0.6}px Arial`;
            mapCtx.fillText(blockInfo.emoji, screenX + cellSize * 0.2, screenY + cellSize * 0.7);
        }
    }
    
    mapCtx.strokeStyle = '#FFD700';
    mapCtx.lineWidth = 2;
    mapCtx.strokeRect(0, 0, size, size);
}

// ==================== ADVANCED BUILDING TOOLS ====================
function generateTree(x, y, z) {
    // Trunk
    for (let h = 0; h < 4; h++) {
        setBlock(x, y + h, z, 'wood');
    }
    // Leaves
    for (let lx = -2; lx <= 2; lx++) {
        for (let lz = -2; lz <= 2; lz++) {
            for (let ly = 2; ly <= 5; ly++) {
                if (Math.abs(lx) + Math.abs(lz) <= 3 && ly !== 3) {
                    setBlock(x + lx, y + ly, z + lz, 'leaves');
                }
            }
        }
    }
    // Top leaves
    setBlock(x, y + 5, z, 'leaves');
    setBlock(x + 1, y + 5, z, 'leaves');
    setBlock(x - 1, y + 5, z, 'leaves');
    setBlock(x, y + 5, z + 1, 'leaves');
    setBlock(x, y + 5, z - 1, 'leaves');
}

function generateTrees() {
    for (let i = 0; i < 20; i++) {
        const x = Math.floor(Math.random() * 40) - 20;
        const z = Math.floor(Math.random() * 40) - 20;
        let y = 61;
        while (getBlock(x, y, z) === 'air' && y > 55) y--;
        generateTree(x, y + 1, z);
    }
    showToast('Generated 20 trees!');
    saveToHistory();
    updateWorldStats();
}

function generateOres() {
    const ores = ['coal', 'iron', 'gold', 'diamond', 'emerald'];
    for (let i = 0; i < 100; i++) {
        const x = Math.floor(Math.random() * 50) - 25;
        const z = Math.floor(Math.random() * 50) - 25;
        const y = 40 + Math.floor(Math.random() * 20);
        const ore = ores[Math.floor(Math.random() * ores.length)];
        setBlock(x, y, z, ore);
    }
    showToast('Generated ores!');
    saveToHistory();
    updateWorldStats();
}

function smoothTerrain() {
    const newTerrain = {};
    
    for (let x = -25; x < 25; x++) {
        for (let z = -25; z < 25; z++) {
            let totalHeight = 0;
            let count = 0;
            
            for (let dx = -1; dx <= 1; dx++) {
                for (let dz = -1; dz <= 1; dz++) {
                    let height = 60;
                    for (let y = 70; y >= 55; y--) {
                        if (getBlock(x + dx, y, z + dz) !== 'air') {
                            height = y;
                            break;
                        }
                    }
                    totalHeight += height;
                    count++;
                }
            }
            
            const avgHeight = Math.floor(totalHeight / count);
            for (let y = 55; y <= 70; y++) {
                if (y <= avgHeight) {
                    const blockType = y === avgHeight ? 'grass' : (y > avgHeight - 3 ? 'dirt' : 'stone');
                    setBlock(x, y, z, blockType);
                } else {
                    setBlock(x, y, z, 'air');
                }
            }
        }
    }
    
    showToast('Terrain smoothed!');
    saveToHistory();
    updateWorldStats();
}

function startAreaSelection() {
    showToast('Click and drag to select area (coming soon)');
}

function fillSelectedArea() {
    if (!selectedArea) {
        showToast('No area selected!');
        return;
    }
    for (let x = selectedArea.x1; x <= selectedArea.x2; x++) {
        for (let y = selectedArea.y1; y <= selectedArea.y2; y++) {
            for (let z = selectedArea.z1; z <= selectedArea.z2; z++) {
                setBlock(x, y, z, currentBlock);
            }
        }
    }
    showToast('Area filled!');
    saveToHistory();
    updateWorldStats();
}

function copySelectedArea() {
    if (!selectedArea) {
        showToast('No area selected!');
        return;
    }
    clipboard = [];
    for (let x = selectedArea.x1; x <= selectedArea.x2; x++) {
        for (let y = selectedArea.y1; y <= selectedArea.y2; y++) {
            for (let z = selectedArea.z1; z <= selectedArea.z2; z++) {
                const block = getBlock(x, y, z);
                if (block !== 'air') {
                    clipboard.push({ x, y, z, block, offsetX: x - selectedArea.x1, offsetY: y - selectedArea.y1, offsetZ: z - selectedArea.z1 });
                }
            }
        }
    }
    showToast(`Copied ${clipboard.length} blocks!`);
}

function pasteArea() {
    if (!clipboard || clipboard.length === 0) {
        showToast('Nothing to paste!');
        return;
    }
    const pos = { x: parseInt(document.getElementById('posX')?.innerText) || 0, 
                  y: parseInt(document.getElementById('posY')?.innerText) || 0, 
                  z: parseInt(document.getElementById('posZ')?.innerText) || 0 };
    
    clipboard.forEach(item => {
        setBlock(pos.x + item.offsetX, pos.y + item.offsetY, pos.z + item.offsetZ, item.block);
    });
    showToast('Pasted!');
    saveToHistory();
    updateWorldStats();
}

function clearSelectedArea() {
    if (!selectedArea) {
        showToast('No area selected!');
        return;
    }
    for (let x = selectedArea.x1; x <= selectedArea.x2; x++) {
        for (let y = selectedArea.y1; y <= selectedArea.y2; y++) {
            for (let z = selectedArea.z1; z <= selectedArea.z2; z++) {
                setBlock(x, y, z, 'air');
            }
        }
    }
    showToast('Area cleared!');
    saveToHistory();
    updateWorldStats();
}

// ==================== HISTORY & UNDO/REDO ====================
function saveToHistory() {
    history = history.slice(0, historyIndex + 1);
    history.push(JSON.parse(JSON.stringify(worldData)));
    historyIndex++;
    if (history.length > 50) {
        history.shift();
        historyIndex--;
    }
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        worldData = JSON.parse(JSON.stringify(history[historyIndex]));
        updateWorldStats();
        render3DView();
        render2DView();
        showToast('Undo');
    }
}

function redo() {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        worldData = JSON.parse(JSON.stringify(history[historyIndex]));
        updateWorldStats();
        render3DView();
        render2DView();
        showToast('Redo');
    }
}

// ==================== WORLD STATS ====================
function updateWorldStats() {
    const totalBlocks = Object.keys(worldData).length;
    const uniqueBlocks = new Set(Object.values(worldData)).size;
    
    document.getElementById('totalBlocks').innerText = totalBlocks;
    document.getElementById('uniqueBlocks').innerText = uniqueBlocks;
    document.getElementById('worldSize').innerText = Math.round(totalBlocks * 0.1);
}

function updateHoverPosition(e) {
    const rect = canvas?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    for (const [key, blockType] of Object.entries(worldData)) {
        const [x, y, z] = key.split(',').map(Number);
        const screenX = projectX(x, z, y);
        const screenY = projectY(x, z, y);
        const size = 12;
        
        if (Math.abs(mouseX - screenX) < size && Math.abs(mouseY - screenY) < size) {
            document.getElementById('hoverX').innerText = x;
            document.getElementById('hoverY').innerText = y;
            document.getElementById('hoverZ').innerText = z;
            document.getElementById('selectedBlock').innerText = BLOCKS[blockType]?.name || blockType;
            break;
        }
    }
}

// ==================== SAVE & EXPORT ====================
function saveWorld() {
    showToast('World saved!');
    saveToHistory();
}

async function exportWorld() {
    showLoading(true);
    try {
        if (typeof JSZip === 'undefined') throw new Error('JSZip not loaded');
        
        const zip = new JSZip();
        const levelDat = JSON.stringify(worldData);
        zip.file('level.dat', levelDat);
        zip.file('levelname.txt', 'Edited World');
        
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'minecraft_world_edited.mcworld';
        a.click();
        URL.revokeObjectURL(url);
        
        showToast('World exported successfully!');
    } catch (error) {
        console.error('Export error:', error);
        alert('Export error: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// ==================== UTILITIES ====================
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = show ? 'flex' : 'none';
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `✓ ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function isHoveringBlock(block) {
    const hoverX = parseInt(document.getElementById('hoverX')?.innerText || '-1');
    const hoverY = parseInt(document.getElementById('hoverY')?.innerText || '-1');
    const hoverZ = parseInt(document.getElementById('hoverZ')?.innerText || '-1');
    return block.x === hoverX && block.y === hoverY && block.z === hoverZ;
}
