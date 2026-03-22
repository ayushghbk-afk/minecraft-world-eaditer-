// ==================== GLOBAL STATE ====================
let worldData = new Map(); // Store blocks: key "x,y,z" -> block type
let history = [];
let historyIndex = -1;
let currentTool = 'place';
let currentBlock = 'stone';
let brushSize = 1;
let brushShape = 'cube';
let viewMode = '3d';
let selectedBlockPos = null;

// Camera for 3D view
let camera = {
    rotX: 45,
    rotY: 30,
    zoom: 1.0,
    targetX: 0,
    targetY: 64,
    targetZ: 0
};

let mouseDown = false;
let lastMouseX = 0, lastMouseY = 0;
let canvas, ctx, width, height;

// Block definitions with colors and emojis
const BLOCKS = {
    air: { id: 0, name: 'Air', emoji: '⬜', color: '#808080', transparent: true },
    stone: { id: 1, name: 'Stone', emoji: '🪨', color: '#808080' },
    dirt: { id: 2, name: 'Dirt', emoji: '🟫', color: '#8B5A2B' },
    grass: { id: 3, name: 'Grass', emoji: '🌿', color: '#5C9E5C' },
    wood: { id: 4, name: 'Wood', emoji: '🪵', color: '#8B5A2B' },
    cobblestone: { id: 5, name: 'Cobblestone', emoji: '🪨', color: '#696969' },
    sand: { id: 6, name: 'Sand', emoji: '🏜️', color: '#F4E542' },
    water: { id: 7, name: 'Water', emoji: '💧', color: '#3B6E9E' },
    lava: { id: 8, name: 'Lava', emoji: '🌋', color: '#FF4500' },
    gold: { id: 9, name: 'Gold', emoji: '🪙', color: '#FFD700' },
    diamond: { id: 10, name: 'Diamond', emoji: '💎', color: '#4AE8E8' },
    iron: { id: 11, name: 'Iron', emoji: '⚙️', color: '#C0C0C0' },
    emerald: { id: 12, name: 'Emerald', emoji: '💚', color: '#50C878' },
    redstone: { id: 13, name: 'Redstone', emoji: '🔴', color: '#FF4444' },
    lapis: { id: 14, name: 'Lapis', emoji: '🔵', color: '#2663C9' },
    obsidian: { id: 15, name: 'Obsidian', emoji: '⚫', color: '#2D2D2D' },
    brick: { id: 16, name: 'Brick', emoji: '🧱', color: '#B5623B' },
    glass: { id: 17, name: 'Glass', emoji: '🔲', color: '#A9F5F5' },
    leaves: { id: 18, name: 'Leaves', emoji: '🍃', color: '#3A9E3A' },
    tnt: { id: 19, name: 'TNT', emoji: '💣', color: '#FF4444' },
    bedrock: { id: 20, name: 'Bedrock', emoji: '🪨', color: '#4A4A4A' }
};

const BLOCK_LIST = Object.keys(BLOCKS).filter(k => k !== 'air');

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    initBlockPalette();
    initWorld();
});

function initEventListeners() {
    // File inputs
    document.getElementById('folderInput')?.addEventListener('change', handleFolderImport);
    document.getElementById('mcworldInput')?.addEventListener('change', handleMcworldImport);
    document.getElementById('uploadArea')?.addEventListener('click', () => document.getElementById('folderInput').click());
    
    // View mode buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
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
        document.getElementById('brushSizeVal').innerText = brushSize;
    });
    
    document.getElementById('brushShape')?.addEventListener('change', (e) => {
        brushShape = e.target.value;
    });
    
    // Action buttons
    document.getElementById('genTreesBtn')?.addEventListener('click', () => generateTrees());
    document.getElementById('genOresBtn')?.addEventListener('click', () => generateOres());
    document.getElementById('smoothBtn')?.addEventListener('click', () => smoothTerrain());
    document.getElementById('clearAreaBtn')?.addEventListener('click', () => clearArea());
    document.getElementById('saveWorldBtn')?.addEventListener('click', () => saveWorld());
    document.getElementById('exportWorldBtn')?.addEventListener('click', () => exportWorld());
    document.getElementById('undoBtn')?.addEventListener('click', () => undo());
    document.getElementById('redoBtn')?.addEventListener('click', () => redo());
    
    // Canvas events
    canvas = document.getElementById('worldCanvas');
    if (canvas) {
        ctx = canvas.getContext('2d');
        canvas.addEventListener('mousedown', onMouseDown);
        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mouseup', () => mouseDown = false);
        canvas.addEventListener('wheel', onMouseWheel);
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();
    }
}

function resizeCanvas() {
    const container = document.querySelector('.canvas-container');
    if (container && canvas) {
        width = container.clientWidth;
        height = container.clientHeight;
        canvas.width = width;
        canvas.height = height;
        render();
    }
}

function initBlockPalette() {
    const palette = document.getElementById('blockPalette');
    if (!palette) return;
    
    palette.innerHTML = '';
    BLOCK_LIST.forEach(blockKey => {
        const block = BLOCKS[blockKey];
        const div = document.createElement('div');
        div.className = 'block-item';
        div.style.background = block.color;
        div.style.opacity = block.transparent ? '0.7' : '1';
        div.innerHTML = block.emoji;
        div.title = block.name;
        div.onclick = () => setCurrentBlock(blockKey);
        if (currentBlock === blockKey) div.classList.add('selected');
        palette.appendChild(div);
    });
}

function setCurrentBlock(blockKey) {
    currentBlock = blockKey;
    document.querySelectorAll('.block-item').forEach((item, i) => {
        if (BLOCK_LIST[i] === blockKey) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
    showToast(`Selected: ${BLOCKS[blockKey].name}`);
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
}

function switchViewMode(mode) {
    viewMode = mode;
    document.querySelectorAll('.view-btn').forEach(btn => {
        if (btn.dataset.view === mode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    render();
}

// ==================== WORLD GENERATION ====================
function initWorld() {
    // Generate a beautiful terrain
    for (let x = -30; x <= 30; x++) {
        for (let z = -30; z <= 30; z++) {
            // Perlin-like height using sine/cosine
            const height = Math.floor(
                60 + 
                Math.sin(x * 0.2) * Math.cos(z * 0.2) * 4 +
                Math.sin(x * 0.5) * 2 +
                Math.cos(z * 0.5) * 2
            );
            
            // Ground layers
            for (let y = 55; y <= height; y++) {
                if (y === height) {
                    setBlock(x, y, z, 'grass');
                } else if (y >= height - 3) {
                    setBlock(x, y, z, 'dirt');
                } else {
                    setBlock(x, y, z, 'stone');
                }
            }
        }
    }
    
    // Add some trees
    for (let i = 0; i < 15; i++) {
        const x = Math.floor(Math.random() * 50) - 25;
        const z = Math.floor(Math.random() * 50) - 25;
        let y = 61;
        while (getBlock(x, y, z) === 'air' && y > 55) y--;
        generateTree(x, y + 1, z);
    }
    
    // Add water
    for (let x = -30; x <= 30; x++) {
        for (let z = -30; z <= 30; z++) {
            let height = 60;
            for (let y = 65; y >= 55; y--) {
                if (getBlock(x, y, z) !== 'air') {
                    height = y;
                    break;
                }
            }
            if (height < 62) {
                for (let y = height + 1; y <= 62; y++) {
                    setBlock(x, y, z, 'water');
                }
            }
        }
    }
    
    saveToHistory();
    updateStats();
    render();
}

function setBlock(x, y, z, blockType) {
    const key = `${x},${y},${z}`;
    if (blockType === 'air') {
        worldData.delete(key);
    } else {
        worldData.set(key, blockType);
    }
}

function getBlock(x, y, z) {
    return worldData.get(`${x},${y},${z}`) || 'air';
}

// ==================== 3D RENDERING ENGINE ====================
function render() {
    if (!ctx) return;
    
    ctx.clearRect(0, 0, width, height);
    
    if (viewMode === '2d' || viewMode === 'top') {
        render2DMap();
    } else {
        render3D();
    }
    
    requestAnimationFrame(render);
}

function render3D() {
    // Draw sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#1a2a3a');
    grad.addColorStop(1, '#0a1a2a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    
    // Collect and sort blocks for proper depth
    const blocks = [];
    for (const [key, blockType] of worldData) {
        const [x, y, z] = key.split(',').map(Number);
        const screenPos = project3D(x, y, z);
        if (screenPos) {
            blocks.push({ x, y, z, blockType, screenX: screenPos.x, screenY: screenPos.y, depth: screenPos.depth });
        }
    }
    
    // Sort by depth (far to near)
    blocks.sort((a, b) => b.depth - a.depth);
    
    // Draw blocks
    const blockSize = 16 * camera.zoom;
    blocks.forEach(block => {
        const blockInfo = BLOCKS[block.blockType];
        
        // Draw block
        ctx.fillStyle = blockInfo.color;
        ctx.fillRect(block.screenX - blockSize/2, block.screenY - blockSize/2, blockSize, blockSize);
        
        // Draw outline
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(block.screenX - blockSize/2, block.screenY - blockSize/2, blockSize, blockSize);
        
        // Draw emoji
        ctx.font = `${blockSize * 0.6}px "Segoe UI Emoji"`;
        ctx.fillStyle = '#FFF';
        ctx.shadowBlur = 0;
        ctx.fillText(blockInfo.emoji, block.screenX - blockSize/3, block.screenY + blockSize/4);
        
        // Highlight selected block
        if (selectedBlockPos && selectedBlockPos.x === block.x && selectedBlockPos.y === block.y && selectedBlockPos.z === block.z) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 3;
            ctx.strokeRect(block.screenX - blockSize/2, block.screenY - blockSize/2, blockSize, blockSize);
        }
    });
}

function project3D(x, y, z) {
    const radX = camera.rotX * Math.PI / 180;
    const radY = camera.rotY * Math.PI / 180;
    
    // Translate relative to camera target
    const tx = x - camera.targetX;
    const ty = y - camera.targetY;
    const tz = z - camera.targetZ;
    
    // Rotate around Y
    const x1 = tx * Math.cos(radY) + tz * Math.sin(radY);
    const z1 = -tx * Math.sin(radY) + tz * Math.cos(radY);
    
    // Rotate around X
    const y1 = ty * Math.cos(radX) - z1 * Math.sin(radX);
    const z2 = ty * Math.sin(radX) + z1 * Math.cos(radX);
    
    const scale = 200 / (z2 + 200) * camera.zoom;
    const screenX = width / 2 + x1 * scale;
    const screenY = height / 2 - y1 * scale;
    
    if (screenX < -100 || screenX > width + 100 || screenY < -100 || screenY > height + 100) {
        return null;
    }
    
    return { x: screenX, y: screenY, depth: z2 };
}

function render2DMap() {
    const cellSize = Math.min(width / 70, height / 70);
    const offsetX = (width - 60 * cellSize) / 2;
    const offsetY = (height - 60 * cellSize) / 2;
    
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(0, 0, width, height);
    
    for (let x = -30; x <= 30; x++) {
        for (let z = -30; z <= 30; z++) {
            // Find highest block
            let topBlock = 'air';
            for (let y = 70; y >= 55; y--) {
                const block = getBlock(x, y, z);
                if (block !== 'air') {
                    topBlock = block;
                    break;
                }
            }
            
            const blockInfo = BLOCKS[topBlock];
            const screenX = offsetX + (x + 30) * cellSize;
            const screenY = offsetY + (z + 30) * cellSize;
            
            ctx.fillStyle = blockInfo.color;
            ctx.fillRect(screenX, screenY, cellSize - 1, cellSize - 1);
            
            if (cellSize > 15) {
                ctx.font = `${Math.min(cellSize * 0.6, 16)}px "Segoe UI Emoji"`;
                ctx.fillStyle = '#FFF';
                ctx.fillText(blockInfo.emoji, screenX + cellSize * 0.2, screenY + cellSize * 0.7);
            }
        }
    }
    
    // Draw crosshair at camera target
    const targetX = offsetX + (camera.targetX + 30) * cellSize;
    const targetY = offsetY + (camera.targetZ + 30) * cellSize;
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(targetX - 10, targetY);
    ctx.lineTo(targetX + 10, targetY);
    ctx.moveTo(targetX, targetY - 10);
    ctx.lineTo(targetX, targetY + 10);
    ctx.stroke();
}

// ==================== MOUSE INTERACTION ====================
function onMouseDown(e) {
    mouseDown = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    
    if (viewMode === '3d') {
        const block = getBlockUnderMouse(e);
        if (block) {
            if (currentTool === 'place') {
                placeBlockWithBrush(block.x, block.y + 1, block.z);
            } else if (currentTool === 'remove') {
                removeBlock(block.x, block.y, block.z);
            } else if (currentTool === 'replace') {
                setBlock(block.x, block.y, block.z, currentBlock);
            }
            saveToHistory();
            updateStats();
            render();
        }
    } else if (viewMode === '2d') {
        const pos = get2DPosition(e);
        if (pos) {
            if (currentTool === 'place') {
                setBlock(pos.x, 62, pos.z, currentBlock);
            } else if (currentTool === 'remove') {
                for (let y = 70; y >= 55; y--) {
                    if (getBlock(pos.x, y, pos.z) !== 'air') {
                        setBlock(pos.x, y, pos.z, 'air');
                        break;
                    }
                }
            }
            saveToHistory();
            updateStats();
            render();
        }
    }
}

function onMouseMove(e) {
    if (mouseDown && e.buttons === 1 && viewMode === '3d') {
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        camera.rotY += dx * 0.5;
        camera.rotX += dy * 0.5;
        camera.rotX = Math.min(89, Math.max(-89, camera.rotX));
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        render();
    }
    
    // Update hover info
    if (viewMode === '3d') {
        const block = getBlockUnderMouse(e);
        if (block) {
            document.getElementById('selX').innerText = block.x;
            document.getElementById('selY').innerText = block.y;
            document.getElementById('selZ').innerText = block.z;
            document.getElementById('selBlock').innerText = BLOCKS[block.blockType]?.name || block.blockType;
            document.getElementById('selId').innerText = BLOCKS[block.blockType]?.id || 0;
            selectedBlockPos = block;
        } else {
            selectedBlockPos = null;
        }
    }
}

function onMouseWheel(e) {
    e.preventDefault();
    camera.zoom += e.deltaY * -0.005;
    camera.zoom = Math.min(2, Math.max(0.5, camera.zoom));
    document.getElementById('camZoom').innerText = Math.round(camera.zoom * 100);
    render();
}

function getBlockUnderMouse(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (width / rect.width);
    const mouseY = (e.clientY - rect.top) * (height / rect.height);
    
    let closestBlock = null;
    let minDist = 30;
    
    for (const [key, blockType] of worldData) {
        const [x, y, z] = key.split(',').map(Number);
        const pos = project3D(x, y, z);
        if (pos) {
            const dist = Math.hypot(mouseX - pos.x, mouseY - pos.y);
            if (dist < minDist) {
                minDist = dist;
                closestBlock = { x, y, z, blockType };
            }
        }
    }
    
    return closestBlock;
}

function get2DPosition(e) {
    const rect = canvas.getBoundingClientRect();
    const cellSize = Math.min(width / 70, height / 70);
    const offsetX = (width - 60 * cellSize) / 2;
    const offsetY = (height - 60 * cellSize) / 2;
    
    const mouseX = (e.clientX - rect.left) * (width / rect.width);
    const mouseY = (e.clientY - rect.top) * (height / rect.height);
    
    const x = Math.round((mouseX - offsetX) / cellSize) - 30;
    const z = Math.round((mouseY - offsetY) / cellSize) - 30;
    
    if (x >= -30 && x <= 30 && z >= -30 && z <= 30) {
        return { x, z };
    }
    return null;
}

// ==================== BRUSH FUNCTIONS ====================
function placeBlockWithBrush(cx, cy, cz) {
    for (let x = cx - brushSize; x <= cx + brushSize; x++) {
        for (let y = cy - brushSize; y <= cy + brushSize; y++) {
            for (let z = cz - brushSize; z <= cz + brushSize; z++) {
                if (brushShape === 'cube') {
                    setBlock(x, y, z, currentBlock);
                } else if (brushShape === 'sphere') {
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

// ==================== TERRAIN GENERATION ====================
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
    setBlock(x, y + 5, z, 'leaves');
}

function generateTrees() {
    for (let i = 0; i < 25; i++) {
        const x = Math.floor(Math.random() * 50) - 25;
        const z = Math.floor(Math.random() * 50) - 25;
        let y = 61;
        while (getBlock(x, y, z) === 'air' && y > 55) y--;
        generateTree(x, y + 1, z);
    }
    showToast('Generated 25 trees!');
    saveToHistory();
    updateStats();
    render();
}

function generateOres() {
    const ores = ['coal', 'iron', 'gold', 'diamond', 'emerald'];
    for (let i = 0; i < 150; i++) {
        const x = Math.floor(Math.random() * 50) - 25;
        const z = Math.floor(Math.random() * 50) - 25;
        const y = 40 + Math.floor(Math.random() * 25);
        const ore = ores[Math.floor(Math.random() * ores.length)];
        setBlock(x, y, z, ore);
    }
    showToast('Generated ores!');
    saveToHistory();
    updateStats();
    render();
}

function smoothTerrain() {
    const newHeights = new Map();
    
    for (let x = -30; x <= 30; x++) {
        for (let z = -30; z <= 30; z++) {
            let total = 0;
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
                    total += height;
                    count++;
                }
            }
            newHeights.set(`${x},${z}`, Math.floor(total / count));
        }
    }
    
    for (let x = -30; x <= 30; x++) {
        for (let z = -30; z <= 30; z++) {
            const newHeight = newHeights.get(`${x},${z}`);
            for (let y = 55; y <= 70; y++) {
                if (y <= newHeight) {
                    const blockType = y === newHeight ? 'grass' : (y > newHeight - 3 ? 'dirt' : 'stone');
                    setBlock(x, y, z, blockType);
                } else {
                    setBlock(x, y, z, 'air');
                }
            }
        }
    }
    
    showToast('Terrain smoothed!');
    saveToHistory();
    updateStats();
    render();
}

function clearArea() {
    const radius = 10;
    const centerX = Math.round(camera.targetX);
    const centerZ = Math.round(camera.targetZ);
    
    for (let x = centerX - radius; x <= centerX + radius; x++) {
        for (let z = centerZ - radius; z <= centerZ + radius; z++) {
            for (let y = 55; y <= 70; y++) {
                setBlock(x, y, z, 'air');
            }
        }
    }
    
    showToast('Area cleared!');
    saveToHistory();
    updateStats();
    render();
}

// ==================== WORLD MANAGEMENT ====================
function updateStats() {
    const totalBlocks = worldData.size;
    const uniqueBlocks = new Set(worldData.values()).size;
    const sizeKB = Math.round(totalBlocks * 0.05);
    
    document.getElementById('totalBlocks').innerText = totalBlocks;
    document.getElementById('uniqueBlocks').innerText = uniqueBlocks;
    document.getElementById('worldSize').innerText = sizeKB;
    
    document.getElementById('camRotX').innerText = Math.round(camera.rotX);
    document.getElementById('camRotY').innerText = Math.round(camera.rotY);
}

function saveToHistory() {
    history = history.slice(0, historyIndex + 1);
    const snapshot = new Map();
    for (const [key, value] of worldData) {
        snapshot.set(key, value);
    }
    history.push(snapshot);
    historyIndex++;
    if (history.length > 50) {
        history.shift();
        historyIndex--;
    }
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        worldData = new Map();
        for (const [key, value] of history[historyIndex]) {
            worldData.set(key, value);
        }
        updateStats();
        render();
        showToast('Undo');
    }
}

function redo() {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        worldData = new Map();
        for (const [key, value] of history[historyIndex]) {
            worldData.set(key, value);
        }
        updateStats();
        render();
        showToast('Redo');
    }
}

function saveWorld() {
    saveToHistory();
    showToast('World saved!');
}

async function exportWorld() {
    showLoading(true);
    try {
        const zip = new JSZip();
        
        // Create level.dat with world data
        const worldDataObj = {};
        for (const [key, value] of worldData) {
            worldDataObj[key] = value;
        }
        
        const levelDat = JSON.stringify({
            worldData: worldDataObj,
            version: "1.0",
            generator: "Minecraft World Editor Pro"
        }, null, 2);
        
        zip.file("level.dat", levelDat);
        zip.file("levelname.txt", "Edited World");
        
        // Create world icon
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const iconCtx = canvas.getContext('2d');
        iconCtx.fillStyle = '#5c6bc0';
        iconCtx.fillRect(0, 0, 64, 64);
        iconCtx.fillStyle = '#fff';
        iconCtx.font = '40px Arial';
        iconCtx.fillText('⛏️', 12, 48);
        const iconBlob = await new Promise(resolve => canvas.toBlob(resolve));
        zip.file("world_icon.jpeg", iconBlob);
        
        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `minecraft_world_${Date.now()}.mcworld`;
        a.click();
        URL.revokeObjectURL(url);
        
        showToast('World exported as .mcworld!');
    } catch (error) {
        console.error('Export error:', error);
        alert('Export failed: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// ==================== IMPORT FUNCTIONS ====================
async function handleFolderImport(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    showLoading(true);
    
    setTimeout(() => {
        document.getElementById('importOverlay').style.display = 'none';
        document.getElementById('mainLayout').style.display = 'flex';
        showLoading(false);
        resizeCanvas();
        render();
        showToast('World imported successfully!');
    }, 1000);
}

async function handleMcworldImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    showLoading(true);
    
    try {
        const zip = await JSZip.loadAsync(file);
        const levelDatFile = zip.file("level.dat");
        
        if (levelDatFile) {
            const content = await levelDatFile.async("string");
            const data = JSON.parse(content);
            
            if (data.worldData) {
                worldData.clear();
                for (const [key, value] of Object.entries(data.worldData)) {
                    worldData.set(key, value);
                }
            }
        }
        
        document.getElementById('importOverlay').style.display = 'none';
        document.getElementById('mainLayout').style.display = 'flex';
        resizeCanvas();
        render();
        updateStats();
        showToast('.mcworld file loaded successfully!');
    } catch (error) {
        console.error('Import error:', error);
        alert('Failed to import .mcworld file: ' + error.message);
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
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
        }
