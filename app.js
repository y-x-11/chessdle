const COLS = ['a','b','c','d','e','f','g','h'];
const PIECES = {
    'wp': '♙', 'wn': '♘', 'wb': '♗', 'wr': '♖', 'wq': '♕', 'wk': '♔',
    'bp': '♟', 'bn': '♞', 'bb': '♝', 'br': '♜', 'bq': '♛', 'bk': '♚'
};

// State
let answerBoard = []; // 64 length arr of {type, color}
let playerBoard = new Array(64).fill(null);
let boardOrientation = 'white';
let currentTool = 'hand';
let selectedTrayPiece = null;
let penColor = 'red';
let guesses = [];
const MAX_GUESSES = 8;
let gameOver = false;
let draggedPieceType = null;
let dragSourceIndex = null;
let stats = { played: 0, wins: 0, currentStreak: 0, maxStreak: 0, dist: new Array(MAX_GUESSES).fill(0) };

function loadStats() {
    const saved = localStorage.getItem('chessdleStats');
    if(saved) {
        try { 
            stats = JSON.parse(saved); 
            while(stats.dist.length < MAX_GUESSES) stats.dist.push(0);
        } catch(e) {}
    }
}
function updateStats(win, numGuesses) {
    stats.played++;
    if(win) {
        stats.wins++;
        stats.currentStreak++;
        stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
        stats.dist[numGuesses - 1]++;
    } else {
        stats.currentStreak = 0;
    }
    localStorage.setItem('chessdleStats', JSON.stringify(stats));
}
function showStats() {
    document.getElementById('stat-played').innerText = stats.played;
    let winRate = stats.played === 0 ? 0 : Math.round((stats.wins / stats.played) * 100);
    document.getElementById('stat-win-rate').innerText = winRate;
    document.getElementById('stat-current-streak').innerText = stats.currentStreak;
    document.getElementById('stat-max-streak').innerText = stats.maxStreak;
    const distContainer = document.getElementById('guess-distribution');
    distContainer.innerHTML = '';
    const maxVal = Math.max(...stats.dist, 1);
    const isGameWon = gameOver && playerBoard.every((p, i) => p === answerBoard[i]);
    for(let i=0; i<MAX_GUESSES; i++) {
        const val = stats.dist[i];
        const pct = Math.max(5, (val / maxVal) * 100);
        const highlight = (isGameWon && i === (guesses.length - 1)) ? 'highlight' : '';
        distContainer.innerHTML += `
            <div class="dist-row">
                <div>${i+1}</div>
                <div class="dist-bar-container">
                    <div class="dist-bar ${highlight}" style="width: ${pct}%">${val}</div>
                </div>
            </div>
        `;
    }
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    document.getElementById('stats-modal').classList.remove('hidden');
}

// UI Elements
const boardEl = document.getElementById('board');
const canvas = document.getElementById('draw-layer');
const ctx = canvas.getContext('2d');
const pieceTrayWhite = document.getElementById('piece-tray-bottom');
const pieceTrayBlack = document.getElementById('piece-tray-top');

// Initialize Game
function init() {
    loadStats();
    answerBoard = new Array(64).fill(null);
    try {
        generateTargetBoard();
    } catch(e) {
        console.error(e);
        setTimeout(() => showAlert("Failed to load chess engine! Please ensure you have an active internet connection."), 500);
    }
    renderInventory();
    renderTrays();
    renderBoard();
    setupCanvas();
    setupEventListeners();
    window.addEventListener('resize', resizeCanvas);
}

// Generate an exact valid position using chess.js
function generateTargetBoard() {
    const chess = new Chess();
    // Play 30 random valid moves
    let numMoves = Math.floor(Math.random() * 20) + 20; 
    for(let i=0; i<numMoves; i++) {
        const moves = chess.moves();
        if(moves.length === 0) break; // Checkmate/stalemate
        const move = moves[Math.floor(Math.random() * moves.length)];
        chess.move(move);
    }
    
    // Parse the board into our 1D array (a8 to h1)
    const currentFenBoard = chess.board(); // 8x8 array
    answerBoard = [];
    for(let r=0; r<8; r++) {
        for(let c=0; c<8; c++) {
            const square = currentFenBoard[r][c];
            if(square) {
                answerBoard.push(square.color + square.type);
            } else {
                answerBoard.push(null);
            }
        }
    }
}

// Build piece trays
function renderTrays() {
    const wp = ['wp', 'wn', 'wb', 'wr', 'wq', 'wk'];
    const bp = ['bp', 'bn', 'bb', 'br', 'bq', 'bk'];
    
    pieceTrayWhite.innerHTML = wp.map(p => `<div class="tray-piece piece-${p[1]}" data-piece="${p}" style="color:var(--piece-white);">${PIECES[p]}</div>`).join('');
    pieceTrayBlack.innerHTML = bp.map(p => `<div class="tray-piece piece-${p[1]}" data-piece="${p}" style="color:var(--piece-black);">${PIECES[p]}</div>`).join('');
}

function renderInventory() {
    let invW = {k:0, q:0, r:0, b:0, n:0, p:0};
    let invB = {k:0, q:0, r:0, b:0, n:0, p:0};
    answerBoard.forEach(p => {
        if(p) { if(p[0]==='w') invW[p[1]]++; else invB[p[1]]++; }
    });
    let wHtml = ['k','q','r','b','n','p'].filter(t => invW[t]>0).map(t => `${invW[t]}${PIECES['w'+t]}`).join(' ');
    let bHtml = ['k','q','r','b','n','p'].filter(t => invB[t]>0).map(t => `${invB[t]}${PIECES['b'+t]}`).join(' ');
    
    document.getElementById('inventory-list').innerHTML = `
        <div class="inv-row" style="color:var(--piece-white); text-shadow: 0 2px 4px rgba(0,0,0,0.8);">${wHtml}</div>
        <div class="inv-row" style="color:#000; text-shadow: 0 0 15px rgba(255,255,255,0.9);">${bHtml}</div>
    `;
}

function getSquareClass(index) {
    let r = Math.floor(index / 8);
    let c = index % 8;
    return (r + c) % 2 === 0 ? 'light' : 'dark';
}

function renderBoard() {
    boardEl.innerHTML = '';
    for(let i=0; i<64; i++) {
        let visualIndex = boardOrientation === 'white' ? i : 63 - i;
        const square = document.createElement('div');
        square.className = `square ${getSquareClass(visualIndex)}`;
        square.dataset.index = visualIndex;
        
        const pieceId = playerBoard[visualIndex];
        if(pieceId) {
            const pieceHtml = document.createElement('span');
            pieceHtml.className = `piece-text piece-${pieceId[1]}`;
            pieceHtml.innerHTML = PIECES[pieceId];
            pieceHtml.style.color = pieceId[0] === 'w' ? 'var(--piece-white)' : 'var(--piece-black)';
            
            // Allow piece on board to be dragged
            pieceHtml.setAttribute('draggable', 'true');
            pieceHtml.addEventListener('dragstart', (e) => {
                if(currentTool !== 'hand' || gameOver) { e.preventDefault(); return; }
                draggedPieceType = pieceId;
                dragSourceIndex = visualIndex;
                e.dataTransfer.effectAllowed = 'move';
                // Unselect tray to avoid accidental drops
                selectedTrayPiece = null;
                document.querySelectorAll('.tray-piece').forEach(t => t.classList.remove('selected'));
            });
            
            square.appendChild(pieceHtml);
        }
        
        boardEl.appendChild(square);
    }
    resizeCanvas();
}

// Canvas Drawings
let isDrawing = false;
let lastX = 0; let lastY = 0;
let drawData = [];

function setupCanvas() {
    resizeCanvas();
    const wrapper = document.querySelector('.board-wrapper');
    // Events need to be on the canvas wrapper or canvas if it has pointer-events: auto
}

function resizeCanvas() {
    const parent = document.querySelector('.board-wrapper');
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    redrawCanvas();
}

function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // basic lines and arrows
    drawData.forEach(stroke => {
        ctx.beginPath();
        ctx.strokeStyle = stroke.color;
        ctx.fillStyle = stroke.color;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        if(!stroke.type || stroke.type === 'pen') {
            for(let i=0; i<stroke.points.length; i++) {
                const pt = stroke.points[i];
                const px = (pt.x / stroke.width) * canvas.width;
                const py = (pt.y / stroke.height) * canvas.height;
                if(i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.stroke();
        } else if (stroke.type === 'arrow' && stroke.points.length > 1) {
            const start = stroke.points[0];
            const end = stroke.points[1];
            const sx = (start.x / stroke.width) * canvas.width;
            const sy = (start.y / stroke.height) * canvas.height;
            const ex = (end.x / stroke.width) * canvas.width;
            const ey = (end.y / stroke.height) * canvas.height;
            
            ctx.moveTo(sx, sy);
            ctx.lineTo(ex, ey);
            ctx.stroke();
            
            const angle = Math.atan2(ey - sy, ex - sx);
            const headlen = 15;
            ctx.beginPath();
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex - headlen * Math.cos(angle - Math.PI / 6), ey - headlen * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(ex - headlen * Math.cos(angle + Math.PI / 6), ey - headlen * Math.sin(angle + Math.PI / 6));
            ctx.lineTo(ex, ey);
            ctx.fill();
        }
    });
}

function setupEventListeners() {
    document.querySelectorAll('.tray-piece').forEach(el => {
        el.setAttribute('draggable', 'true');
        
        el.addEventListener('dragstart', (e) => {
            if(currentTool !== 'hand' || gameOver) { e.preventDefault(); return; }
            document.querySelectorAll('.tray-piece').forEach(t => t.classList.remove('selected'));
            el.classList.add('selected');
            selectedTrayPiece = el.dataset.piece;
            selectTool('hand');
            
            draggedPieceType = el.dataset.piece;
            dragSourceIndex = null;
            e.dataTransfer.effectAllowed = 'copy';
        });

        el.addEventListener('click', (e) => {
            if(gameOver) return;
            document.querySelectorAll('.tray-piece').forEach(t => t.classList.remove('selected'));
            el.classList.add('selected');
            selectedTrayPiece = el.dataset.piece;
            selectTool('hand');
        });
    });

    boardEl.addEventListener('mousedown', handleBoardClick);

    // Board Drop Events
    boardEl.addEventListener('dragover', (e) => {
        if(currentTool !== 'hand' || gameOver) return;
        const tgt = e.target.closest('.square');
        if(tgt) { e.preventDefault(); } // allow drop
    });

    boardEl.addEventListener('drop', (e) => {
        if(currentTool !== 'hand' || gameOver) return;
        const tgt = e.target.closest('.square');
        if(tgt) {
            e.preventDefault();
            const destIndex = parseInt(tgt.dataset.index);
            if(draggedPieceType) {
                playerBoard[destIndex] = draggedPieceType;
                if(dragSourceIndex !== null && dragSourceIndex !== destIndex) {
                    playerBoard[dragSourceIndex] = null; // Remove from source after move
                }
                draggedPieceType = null;
                renderBoard();
            }
        }
    });

    
    // Canvas pointer events handling
    canvas.addEventListener('mousedown', (e) => {
        if(currentTool !== 'pen' && currentTool !== 'arrow' && currentTool !== 'eraser') return;
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (currentTool === 'eraser') {
            performErase(x, y, rect);
            return;
        }

        lastX = x;
        lastY = y;
        drawData.push({ type: currentTool, color: penColor, points: [{x: lastX, y: lastY}], width: canvas.width, height: canvas.height });
    });
    canvas.addEventListener('mousemove', (e) => {
        if(!isDrawing || (currentTool !== 'pen' && currentTool !== 'arrow' && currentTool !== 'eraser')) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (currentTool === 'eraser') {
            performErase(x, y, rect);
            return;
        }
        
        let stroke = drawData[drawData.length-1];
        if(currentTool === 'pen') {
            stroke.points.push({x, y});
        } else if (currentTool === 'arrow') {
            if(stroke.points.length === 1) stroke.points.push({x, y});
            else stroke.points[1] = {x, y};
        }
        redrawCanvas();
    });
    window.addEventListener('mouseup', () => isDrawing = false);

    function performErase(x, y, rect) {
        const threshold = 15;
        let erasedStroke = false;
        
        // 1. Delete drawings intersecting the eraser
        for(let i = drawData.length - 1; i >= 0; i--) {
            const stroke = drawData[i];
            let hit = false;
            
            if (stroke.type === 'arrow' && stroke.points.length > 1) {
                const s = stroke.points[0]; const end = stroke.points[1];
                for(let k=0; k<=10; k++) {
                    const ix = s.x + (end.x - s.x) * (k/10);
                    const iy = s.y + (end.y - s.y) * (k/10);
                    const px = (ix / stroke.width) * canvas.width;
                    const py = (iy / stroke.height) * canvas.height;
                    if(Math.hypot(px - x, py - y) < threshold) { hit = true; break; }
                }
            } else {
                for(let pt of stroke.points) {
                    const px = (pt.x / stroke.width) * canvas.width;
                    const py = (pt.y / stroke.height) * canvas.height;
                    if(Math.hypot(px - x, py - y) < threshold) { hit = true; break; }
                }
            }
            
            if(hit) {
                drawData.splice(i, 1);
                erasedStroke = true;
            }
        }
        if(erasedStroke) redrawCanvas();

        // 2. Erase physical pieces beneath
        const col = Math.floor(x / (rect.width / 8));
        const row = Math.floor(y / (rect.height / 8));
        if(col >= 0 && col < 8 && row >= 0 && row < 8) {
            const visualIndex = row * 8 + col;
            if(playerBoard[visualIndex]) {
                playerBoard[visualIndex] = null;
                renderBoard();
            }
        }
    }

    // Tools
    document.getElementById('tool-hand').addEventListener('click', () => selectTool('hand'));
    document.getElementById('tool-eraser').addEventListener('click', () => selectTool('eraser'));
    document.getElementById('tool-pen').addEventListener('click', (e) => {
        selectTool('pen');
        const picker = document.getElementById('color-picker');
        document.getElementById('tool-pen').parentElement.appendChild(picker);
        picker.classList.remove('hidden');
        document.getElementById('trash-menu').classList.add('hidden');
        document.getElementById('flip-menu').classList.add('hidden');
    });
    document.getElementById('tool-arrow').addEventListener('click', (e) => {
        selectTool('arrow');
        const picker = document.getElementById('color-picker');
        document.getElementById('tool-arrow').parentElement.appendChild(picker);
        picker.classList.remove('hidden');
        document.getElementById('trash-menu').classList.add('hidden');
        document.getElementById('flip-menu').classList.add('hidden');
    });
    document.getElementById('btn-trash').addEventListener('click', () => {
        document.getElementById('trash-menu').classList.toggle('hidden');
        document.getElementById('color-picker').classList.add('hidden');
        document.getElementById('flip-menu').classList.add('hidden');
    });
    document.getElementById('btn-flip').addEventListener('click', () => {
        document.getElementById('flip-menu').classList.toggle('hidden');
        document.getElementById('trash-menu').classList.add('hidden');
        document.getElementById('color-picker').classList.add('hidden');
    });
    document.getElementById('flip-pieces').addEventListener('click', () => {
        boardOrientation = boardOrientation === 'white' ? 'black' : 'white';
        renderBoard();
        redrawCanvas();
        document.getElementById('flip-menu').classList.add('hidden');
    });
    document.getElementById('flip-all').addEventListener('click', () => {
        boardOrientation = boardOrientation === 'white' ? 'black' : 'white';
        drawData.forEach(stroke => {
            stroke.points.forEach(pt => {
                pt.x = stroke.width - pt.x;
                pt.y = stroke.height - pt.y;
            });
        });
        renderBoard();
        redrawCanvas();
        document.getElementById('flip-menu').classList.add('hidden');
    });

    // Color Swatches
    document.querySelectorAll('.color-swatch').forEach(sw => {
        sw.addEventListener('click', () => {
            penColor = sw.dataset.color;
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            sw.classList.add('active');
            document.getElementById('color-picker').classList.add('hidden');
        });
    });

    // Trash Options
    document.getElementById('clear-pieces').addEventListener('click', () => { playerBoard.fill(null); renderBoard(); document.getElementById('trash-menu').classList.add('hidden');});
    document.getElementById('clear-drawings').addEventListener('click', () => { drawData = []; redrawCanvas(); document.getElementById('trash-menu').classList.add('hidden');});
    document.getElementById('clear-both').addEventListener('click', () => {
        playerBoard.fill(null); renderBoard();
        drawData = []; redrawCanvas();
        document.getElementById('trash-menu').classList.add('hidden');
    });

    // Modals
    document.getElementById('btn-stats').addEventListener('click', showStats);
    document.getElementById('btn-tutorial').addEventListener('click', () => {
        document.getElementById('modal-overlay').classList.remove('hidden');
        document.getElementById('tutorial-modal').classList.remove('hidden');
    });
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
            document.getElementById('modal-overlay').classList.add('hidden');
        });
    });

    // Submit
    document.getElementById('btn-submit').addEventListener('click', submitGuess);
    
    document.getElementById('btn-play-again').addEventListener('click', () => {
        gameOver = false;
        guesses = [];
        playerBoard.fill(null);
        drawData = [];
        document.getElementById('guess-count').innerText = 0;
        document.getElementById('guesses-container').innerHTML = '';
        generateTargetBoard();
        renderBoard();
        redrawCanvas();
        document.getElementById('modal-overlay').classList.add('hidden');
    });
}

function selectTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tool-${tool}`).classList.add('active');
    
    if(tool !== 'pen' && tool !== 'arrow') {
        document.getElementById('color-picker').classList.add('hidden');
    }
    
    if(tool === 'pen' || tool === 'arrow' || tool === 'eraser') {
        canvas.style.pointerEvents = 'auto'; // allow drawing and unified erasing over the board
    } else {
        canvas.style.pointerEvents = 'none'; // ignore canvas, click board
    }

    if(tool !== 'hand') {
        selectedTrayPiece = null;
        document.querySelectorAll('.tray-piece').forEach(t => t.classList.remove('selected'));
    }
}

function handleBoardClick(e) {
    if(gameOver) return;
    const tgt = e.target.closest('.square');
    if(!tgt) return;
    const index = parseInt(tgt.dataset.index);

    // Exclude dragstart source from accidentally dropping piece
    // Native drag doesn't trigger click until drag ends, but mousedown triggers instantly.
    // If we rely on click instead of mousedown, we can differentiate native drag!
    // But since we use mousedown, we ONLY want mousedown to deploy piece IF dragging isn't happening.
    // To be safe, we just place piece if selectedTrayPiece is active. We don't remove on mousedown anymore to avoid interference.
    if(currentTool === 'hand') {
        if(selectedTrayPiece && e.target.className.includes('square')) {
            playerBoard[index] = selectedTrayPiece;
            renderBoard();
        }
    } else if(currentTool === 'eraser') {
        playerBoard[index] = null;
        renderBoard();
    }
}

function validateFenCustom(boardArr) {
    // Generate sparse FEN from our 64 array
    let fen = '';
    let empty = 0;
    let counts = {wk:0, bk:0, wp:0, bp:0};

    // check pawns on 1st or 8th
    for(let i=0; i<8; i++) {
        if(boardArr[i] === 'wp' || boardArr[i] === 'bp' || boardArr[56+i] === 'wp' || boardArr[56+i] === 'bp') {
            return "Pawns cannot be on the 1st or 8th rank.";
        }
    }

    for(let r=0; r<8; r++) {
        for(let c=0; c<8; c++) {
            const p = boardArr[r*8 + c];
            if(!p) {
                empty++;
            } else {
                if(empty>0) { fen += empty; empty = 0; }
                const type = p[1];
                fen += p[0] === 'w' ? type.toUpperCase() : type;
                if(p === 'wk') counts.wk++;
                if(p === 'bk') counts.bk++;
                if(p === 'wp') counts.wp++;
                if(p === 'bp') counts.bp++;
            }
        }
        if(empty>0) { fen += empty; empty = 0; }
        if(r < 7) fen += '/';
    }
    
    if(counts.wk !== 1) return "White must have exactly 1 King.";
    if(counts.bk !== 1) return "Black must have exactly 1 King.";
    if(counts.wp > 8) return "White has too many pawns.";
    if(counts.bp > 8) return "Black has too many pawns.";
    
    // Check kings touching
    const k1 = boardArr.indexOf('wk');
    const k2 = boardArr.indexOf('bk');
    const r1 = Math.floor(k1/8), c1 = k1%8;
    const r2 = Math.floor(k2/8), c2 = k2%8;
    if(Math.abs(r1-r2) <= 1 && Math.abs(c1-c2) <= 1) {
        return "Kings cannot be touching.";
    }

    // Try parsing with chess.js just in case to check valid FEN strictly
    const fullFen = fen + " w - - 0 1";
    const chess = new Chess();
    // Validate string. chess.js doesn't expose robust validation unless we try to load. Load returns true/false.
    if(!chess.load(fullFen)) {
        // Wait, chess.load might fail if black is in check but it's white's turn, etc.
        // It's a game, the Wordle guessing doesn't strictly need perfect move timing.
        // The standard counts are enough to prevent nonsense moves.
    }
    return null; // Valid
}

function submitGuess() {
    if(gameOver) return;
    
    const err = validateFenCustom(playerBoard);
    if(err) {
        showAlert(err);
        return;
    }

    // Wordle matching Logic
    // Step 1: Find Greens exactly
    let results = new Array(64).fill('grey');
    let targetPool = []; 
    
    for(let i=0; i<64; i++) {
        if(playerBoard[i] && playerBoard[i] === answerBoard[i]) {
            results[i] = 'green';
        } else if(answerBoard[i]) {
            targetPool.push(answerBoard[i]);
        }
    }

    // Step 2: Find Yellows and Oranges
    for(let i=0; i<64; i++) {
        if(playerBoard[i] && results[i] !== 'green') {
            const poolIndex = targetPool.indexOf(playerBoard[i]);
            if(poolIndex > -1) {
                let isHot = false;
                let row = Math.floor(i/8), col = i%8;
                for(let dr=-1; dr<=1; dr++) {
                    for(let dc=-1; dc<=1; dc++) {
                        if(dr===0 && dc===0) continue;
                        let nr = row+dr, nc = col+dc;
                        if(nr>=0 && nr<8 && nc>=0 && nc<8) {
                            let ni = nr*8 + nc;
                            if(answerBoard[ni] === playerBoard[i] && answerBoard[ni] !== playerBoard[ni]) isHot = true;
                        }
                    }
                }
                results[i] = isHot ? 'orange' : 'yellow';
                targetPool.splice(poolIndex, 1);
            }
        }
    }

    guesses.push({ board: [...playerBoard], results });
    document.getElementById('guess-count').innerText = guesses.length;
    renderHistory();
    
    // Colorize current board briefly
    document.querySelectorAll('.square').forEach((sq, i) => {
        let visualIndex = parseInt(sq.dataset.index);
        sq.classList.remove('green-hl', 'yellow-hl', 'orange-hl');
        if(results[visualIndex] === 'green') sq.classList.add('green-hl');
        if(results[visualIndex] === 'yellow') sq.classList.add('yellow-hl');
        if(results[visualIndex] === 'orange') sq.classList.add('orange-hl');
    });

    // Check Win
    const isWin = playerBoard.every((p, i) => p === answerBoard[i]);
    if(isWin) {
        gameOver = true;
        updateStats(true, guesses.length);
        setTimeout(() => showGameOver(true), 1000);
    } else if (guesses.length >= MAX_GUESSES) {
        gameOver = true;
        updateStats(false, guesses.length);
        setTimeout(() => showGameOver(false), 1000);
    }
}

function showAlert(msg) {
    document.getElementById('alert-message').innerText = msg;
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('alert-modal').classList.remove('hidden');
}

function showGameOver(win) {
    document.getElementById('game-over-title').innerText = win ? 'You Won!' : 'Game Over';
    document.getElementById('game-over-title').style.color = win ? 'var(--board-green)' : '#ef4444';
    document.getElementById('game-over-message').innerText = win ? `You guessed the board in ${guesses.length} tries!` : 'You ran out of tries.';
    
    // show solution
    const solBoard = document.getElementById('solution-board');
    solBoard.innerHTML = '';
    for(let i=0; i<64; i++) {
        const square = document.createElement('div');
        square.className = `square ${getSquareClass(i)}`;
        if(answerBoard[i]) {
            const pieceHtml = document.createElement('span');
            pieceHtml.className = 'piece-text';
            pieceHtml.innerHTML = PIECES[answerBoard[i]];
            pieceHtml.style.color = answerBoard[i][0] === 'w' ? 'var(--piece-white)' : 'var(--piece-black)';
            square.appendChild(pieceHtml);
        }
        solBoard.appendChild(square);
    }

    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('game-over-modal').classList.remove('hidden');
}

function renderHistory() {
    const cont = document.getElementById('guesses-container');
    cont.innerHTML = '';
    
    for(let idx = guesses.length - 1; idx >= 0; idx--) {
        let g = guesses[idx];
        const row = document.createElement('div');
        row.className = 'guess-row';
        row.style.animationDelay = `${(guesses.length - 1 - idx) * 0.1}s`;
        
        // build mini board
        let miniHtml = `<div class="mini-board-preview">`;
        for(let i=0; i<64; i++) {
            let col = g.results[i] === 'green' ? 'var(--board-green)' : 
                      g.results[i] === 'orange' ? 'var(--board-orange)' : 
                      g.results[i] === 'yellow' ? 'var(--board-yellow)' : '#555';
            miniHtml += `<div class="mini-square" style="background:${col}"></div>`;
        }
        miniHtml += `</div>`;
        
        let stats = `<div class="guess-stats"><strong>Guess ${idx+1}</strong>`;
        let greens = g.results.filter(r => r==='green').length;
        let oranges = g.results.filter(r => r==='orange').length;
        let yellows = g.results.filter(r => r==='yellow').length;
        stats += `<span><span style="color:var(--board-green)">■</span> ${greens} <span style="color:var(--board-orange)">■</span> ${oranges} <span style="color:var(--board-yellow)">■</span> ${yellows}</span></div>`;
        
        row.innerHTML = miniHtml + stats;
        cont.appendChild(row);
    }
}

// Kick off
init();
