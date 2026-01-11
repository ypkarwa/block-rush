// Game Configuration
const GAME_CONFIG = {
    GRID_SIZE: 7,
    INITIAL_BALANCE: 10.00,
    GAME_COST: 1.00,
    LINE_PAYOUT: 0.0215, // $0.0215 per line (adjusted for 90% RTP)
    TARGET_RTP: 0.90, // 90% return to player
    MAX_MULTIPLIER: 10,
    // Max win that is allowed for a single round (can be overridden by backend)
    MAX_ROUND_WIN: 10.00,
    // Turn timer configuration
    TURN_TIME_LIMIT: 15,
    // Golden pot configuration
    POT_LIMIT: [5,6,7]
};

// Game State
let gameState = {
    grid: [],
    balance: GAME_CONFIG.INITIAL_BALANCE,
    currentMultiplier: 1,
    linesCleared: 0,
    selectedBlock: null,
    blockOptions: [],
    isGameOver: false,
    autoPlay: false,
    consecutiveClears: 0,
    // Performance tracking for dynamic RTP
    totalGamesPlayed: 0,
    totalAmountWagered: 0,
    totalAmountWon: 0,
    recentPerformance: [], // Last 10 games performance
    difficultyMultiplier: 1.0, // Increases as player performs too well
    // Global timer for turn countdown
    timerInterval: null,
    timeRemaining: GAME_CONFIG.TURN_TIME_LIMIT,
    currentTurnTimeLimit: GAME_CONFIG.TURN_TIME_LIMIT,
    // Round tracking (balance at the start of the round after cost is deducted)
    roundStartBalance: GAME_CONFIG.INITIAL_BALANCE,
    // Block set tracking (5-block cycles)
    blocksPlacedInSet: 0,
    // Golden pot
    potValue: 0,
    goldenCells: new Set(),
    // Golden block batch + tracking
    goldenBatchActive: false,
    goldenBatchBlocksRemaining: 0,
    goldenBlocks: []
};

function stopTurnTimer() {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
}

// Show timer expiry message
function showTimerExpiredMessage() {
    // Timer expired - game ends
}

function startTurnTimer() {
    stopTurnTimer();
    // Responsible for turn countdown
    gameState.timerInterval = setInterval(() => {
        if (gameState.isGameOver) {
            stopTurnTimer();
            return;
        }

        // Turn countdown: if time runs out, game ends
        if (gameState.timeRemaining > 0) {
            gameState.timeRemaining = Math.max(0, gameState.timeRemaining - 1);
            if (gameState.timeRemaining <= 0) {
                showTimerExpiredMessage();
                stopTurnTimer();
                endGame();
                return;
            }
        }

        updateUI();
    }, 1000);
}

// Block Shapes - Core Tetris pieces plus simple blocks
const BLOCK_SHAPES = {
    single: [[1]],
    double: [[1, 1]],
    double_vertical: [[1], [1]],
    I_piece: [[1, 1, 1, 1]],
    I_piece_vertical: [[1], [1], [1], [1]],
    O_piece: [[1, 1], [1, 1]],
    T_piece: [[0, 1, 0], [1, 1, 1]],
    T_piece_rotated1: [[1, 0], [1, 1], [1, 0]],
    T_piece_rotated2: [[1, 1, 1], [0, 1, 0]],
    T_piece_rotated3: [[0, 1], [1, 1], [0, 1]],
    L_piece: [[1, 0, 0], [1, 1, 1]],
    L_piece_rotated1: [[1, 1], [1, 0], [1, 0]],
    L_piece_rotated2: [[1, 1, 1], [0, 0, 1]],
    L_piece_rotated3: [[0, 1], [0, 1], [1, 1]],
    J_piece: [[0, 0, 1], [1, 1, 1]],
    J_piece_rotated1: [[1, 0], [1, 0], [1, 1]],
    J_piece_rotated2: [[1, 1, 1], [1, 0, 0]],
    J_piece_rotated3: [[1, 1], [0, 1], [0, 1]],
    S_piece: [[0, 1, 1], [1, 1, 0]],
    S_piece_vertical: [[1, 0], [1, 1], [0, 1]],
    Z_piece: [[1, 1, 0], [0, 1, 1]],
    Z_piece_vertical: [[0, 1], [1, 1], [1, 0]]
};

// Block difficulty metrics (1-10 scale, higher = harder to place)
const BLOCK_DIFFICULTY = {
    single: 1,
    double: 1,
    double_vertical: 1,
    I_piece: 3,
    I_piece_vertical: 3,
    O_piece: 3,
    T_piece: 4,
    T_piece_rotated1: 4,
    T_piece_rotated2: 4,
    T_piece_rotated3: 4,
    L_piece: 4,
    L_piece_rotated1: 4,
    L_piece_rotated2: 4,
    L_piece_rotated3: 4,
    J_piece: 4,
    J_piece_rotated1: 4,
    J_piece_rotated2: 4,
    J_piece_rotated3: 4,
    S_piece: 4,
    S_piece_vertical: 4,
    Z_piece: 4,
    Z_piece_vertical: 4
};

const MAX_BLOCK_DIFFICULTY = Math.max(...Object.values(BLOCK_DIFFICULTY));
const DIFFICULTY_WEIGHT_SETTINGS = {
    bonusPerPoint: 1.2,
    multiplierRange: 0.5
};

function applyDifficultyWeight(baseWeight = 1, difficultyValue = 1) {
    const sanitizedBase = Math.max(0, baseWeight);
    const clampedDifficulty = Math.max(1, Math.min(difficultyValue, MAX_BLOCK_DIFFICULTY));
    const bonus = clampedDifficulty * DIFFICULTY_WEIGHT_SETTINGS.bonusPerPoint;
    const normalized = (clampedDifficulty - 1) / (MAX_BLOCK_DIFFICULTY - 1 || 1);
    const multiplier = 1 + normalized * DIFFICULTY_WEIGHT_SETTINGS.multiplierRange;
    return Math.max((sanitizedBase + bonus) * multiplier, 0.1);
}

// RTP Weights for different block types (higher weight = more likely to appear when RTP is low)
const BLOCK_WEIGHTS = {
    // Reduce single block frequency so the game isn't too simple
    single: { base: 88, rtp_factor: 0.3, difficulty: BLOCK_DIFFICULTY.single },
    double: { base: 16, rtp_factor: 0.4, difficulty: BLOCK_DIFFICULTY.double },
    double_vertical: { base: 16, rtp_factor: 0.4, difficulty: BLOCK_DIFFICULTY.double_vertical },
    I_piece: { base: 9, rtp_factor: 1.2, difficulty: BLOCK_DIFFICULTY.I_piece },
    I_piece_vertical: { base: 9, rtp_factor: 1.2, difficulty: BLOCK_DIFFICULTY.I_piece_vertical },
    O_piece: { base: 11, rtp_factor: 0.7, difficulty: BLOCK_DIFFICULTY.O_piece },
    T_piece: { base: 10, rtp_factor: 1.0, difficulty: BLOCK_DIFFICULTY.T_piece },
    T_piece_rotated1: { base: 10, rtp_factor: 1.0, difficulty: BLOCK_DIFFICULTY.T_piece_rotated1 },
    T_piece_rotated2: { base: 10, rtp_factor: 1.0, difficulty: BLOCK_DIFFICULTY.T_piece_rotated2 },
    T_piece_rotated3: { base: 10, rtp_factor: 1.0, difficulty: BLOCK_DIFFICULTY.T_piece_rotated3 },
    L_piece: { base: 9, rtp_factor: 1.1, difficulty: BLOCK_DIFFICULTY.L_piece },
    L_piece_rotated1: { base: 9, rtp_factor: 1.1, difficulty: BLOCK_DIFFICULTY.L_piece_rotated1 },
    L_piece_rotated2: { base: 9, rtp_factor: 1.1, difficulty: BLOCK_DIFFICULTY.L_piece_rotated2 },
    L_piece_rotated3: { base: 9, rtp_factor: 1.1, difficulty: BLOCK_DIFFICULTY.L_piece_rotated3 },
    J_piece: { base: 9, rtp_factor: 1.1, difficulty: BLOCK_DIFFICULTY.J_piece },
    J_piece_rotated1: { base: 9, rtp_factor: 1.1, difficulty: BLOCK_DIFFICULTY.J_piece_rotated1 },
    J_piece_rotated2: { base: 9, rtp_factor: 1.1, difficulty: BLOCK_DIFFICULTY.J_piece_rotated2 },
    J_piece_rotated3: { base: 9, rtp_factor: 1.1, difficulty: BLOCK_DIFFICULTY.J_piece_rotated3 },
    S_piece: { base: 8, rtp_factor: 1.3, difficulty: BLOCK_DIFFICULTY.S_piece },
    S_piece_vertical: { base: 8, rtp_factor: 1.3, difficulty: BLOCK_DIFFICULTY.S_piece_vertical },
    Z_piece: { base: 8, rtp_factor: 1.3, difficulty: BLOCK_DIFFICULTY.Z_piece },
    Z_piece_vertical: { base: 8, rtp_factor: 1.3, difficulty: BLOCK_DIFFICULTY.Z_piece_vertical }
};

// Initialize the game
function initGame() {
    // Deduct the cost to play the first game
    gameState.balance -= GAME_CONFIG.GAME_COST;
    // Track balance at the start of this round (after cost deduction)
    gameState.roundStartBalance = gameState.balance;
    // Reset turn timer
    gameState.currentTurnTimeLimit = GAME_CONFIG.TURN_TIME_LIMIT;
    gameState.timeRemaining = gameState.currentTurnTimeLimit;
    // Reset 5-block set tracking
    gameState.blocksPlacedInSet = 0;
    gameState.potValue = 0;
    gameState.goldenCells = new Set();
    
    createGrid();
    generateBlockOptions();
    
    // Check if game is immediately over (very rare but possible)
    if (isGameOver()) {
        endGame();
    } else {
        startTurnTimer();
    }
    
    updateUI();
    
    // Add event listeners
    document.addEventListener('keydown', handleKeyPress);
}

// Create the 7x7 grid
function createGrid() {
    gameState.grid = Array(GAME_CONFIG.GRID_SIZE).fill().map(() => 
        Array(GAME_CONFIG.GRID_SIZE).fill(0)
    );
    
    const gameBoard = document.getElementById('gameBoard');
    gameBoard.innerHTML = '';
    
    for (let row = 0; row < GAME_CONFIG.GRID_SIZE; row++) {
        for (let col = 0; col < GAME_CONFIG.GRID_SIZE; col++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            cell.addEventListener('click', () => handleCellClick(row, col));
            cell.addEventListener('mouseenter', () => showBlockPreview(row, col));
            cell.addEventListener('mouseleave', () => clearBlockPreview());
            
            gameBoard.appendChild(cell);
        }
    }
}

// Handle cell click for block placement
function handleCellClick(row, col) {
    if (!gameState.selectedBlock || gameState.isGameOver) return;
    
    if (canPlaceBlock(gameState.selectedBlock.shape, row, col)) {
        placeBlock(gameState.selectedBlock.shape, row, col);
        clearBlockPreview();
        
        // Check for completed lines
        const clearedLines = checkAndClearLines();
        if (clearedLines > 0) {
            handleLineClear(clearedLines);
        } else {
            gameState.consecutiveClears = 0;
            gameState.currentMultiplier = 1;
        }
        
        // Remove used block and generate new options
        removeUsedBlock();
        
        // Check for game over with all 3 blocks (2 old + 1 new)
        if (isGameOver()) {
            endGame();
        }
        
        updateUI();
    }
}

// Show preview of block placement
function showBlockPreview(row, col) {
    if (!gameState.selectedBlock) return;
    
    clearBlockPreview();
    const shape = gameState.selectedBlock.shape;
    const color = gameState.selectedBlock.color;
    const canPlace = canPlaceBlock(shape, row, col);
    
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c] === 1) {
                const targetRow = row + r;
                const targetCol = col + c;
                
                if (targetRow >= 0 && targetRow < GAME_CONFIG.GRID_SIZE && 
                    targetCol >= 0 && targetCol < GAME_CONFIG.GRID_SIZE) {
                    const cell = document.querySelector(`[data-row="${targetRow}"][data-col="${targetCol}"]`);
                    if (cell) {
                        if (canPlace) {
                            cell.classList.add('preview');
                            cell.style.backgroundColor = `${color}66`; // Semi-transparent
                            cell.style.borderColor = color;
                            cell.style.boxShadow = `0 0 10px ${color}66`;
                        } else {
                            cell.classList.add('invalid-preview');
                        }
                    }
                }
            }
        }
    }
}

// Clear block preview
function clearBlockPreview() {
    document.querySelectorAll('.grid-cell').forEach(cell => {
        cell.classList.remove('preview', 'invalid-preview');
        // Reset custom preview styles
        if (!cell.classList.contains('filled')) {
            cell.style.backgroundColor = '';
            cell.style.borderColor = '';
            cell.style.boxShadow = '';
        }
    });
}

// Check if block can be placed at position
function canPlaceBlock(shape, startRow, startCol) {
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c] === 1) {
                const targetRow = startRow + r;
                const targetCol = startCol + c;
                
                if (targetRow < 0 || targetRow >= GAME_CONFIG.GRID_SIZE ||
                    targetCol < 0 || targetCol >= GAME_CONFIG.GRID_SIZE ||
                    gameState.grid[targetRow][targetCol] === 1) {
                    return false;
                }
            }
        }
    }
    return true;
}

// Place block on the grid
function placeBlock(shape, startRow, startCol) {
    const isGoldenPlacement =
        gameState.goldenBatchActive && gameState.goldenBatchBlocksRemaining > 0;
    const color = gameState.selectedBlock.color;
    const placedCells = [];

    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c] === 1) {
                const targetRow = startRow + r;
                const targetCol = startCol + c;
                gameState.grid[targetRow][targetCol] = 1;
                placedCells.push({ row: targetRow, col: targetCol });
                
                const cell = document.querySelector(`[data-row="${targetRow}"][data-col="${targetCol}"]`);
                if (cell) {
                    cell.classList.add('filled');
                    if (isGoldenPlacement) {
                        // Golden visual style
                        cell.style.background = 'linear-gradient(135deg, #ffd700, #ffa500)';
                        cell.style.borderColor = '#ffec8b';
                        cell.style.boxShadow =
                            '0 0 10px rgba(255, 215, 0, 0.9), inset 0 1px 2px rgba(255, 255, 255, 0.6)';
                    } else {
                        // Apply the block's normal color
                        cell.style.background = `linear-gradient(135deg, ${color}, ${adjustBrightness(color, -20)})`;
                        cell.style.borderColor = adjustBrightness(color, 20);
                        cell.style.boxShadow = `0 0 8px ${color}99, inset 0 1px 2px rgba(255, 255, 255, 0.3)`;
                    }
                }
            }
        }
    }

    // If this placement is golden, track it for full-clear time bonus
    if (isGoldenPlacement && placedCells.length > 0) {
        const bonusSeconds = 3 + Math.floor(Math.random() * 3); // 3–5 seconds
        const cellKeys = new Set(placedCells.map(({ row, col }) => `${row}-${col}`));
        gameState.goldenBlocks.push({
            cells: cellKeys,
            bonusSeconds,
            awarded: false
        });

        gameState.goldenBatchBlocksRemaining -= 1;
        if (gameState.goldenBatchBlocksRemaining <= 0) {
            gameState.goldenBatchActive = false;
            gameState.goldenBatchBlocksRemaining = 0;
        }
    }
}

// Trigger golden pot explosion: convert the NEXT batch of placed blocks into golden blocks
function triggerGoldenPotExplosion() {
    // Reset pot
    gameState.potValue = 0;
    // Activate golden batch: the next full batch of placed blocks becomes golden.
    // Here we treat a "batch" as the next 5 block placements.
    gameState.goldenBatchActive = true;
    gameState.goldenBatchBlocksRemaining = 5;
}

// Check and clear completed lines
function checkAndClearLines() {
    const linesToClear = [];
    
    // Check horizontal lines
    for (let row = 0; row < GAME_CONFIG.GRID_SIZE; row++) {
        if (gameState.grid[row].every(cell => cell === 1)) {
            linesToClear.push({ type: 'row', index: row });
        }
    }
    
    // Check vertical lines
    for (let col = 0; col < GAME_CONFIG.GRID_SIZE; col++) {
        let isComplete = true;
        for (let row = 0; row < GAME_CONFIG.GRID_SIZE; row++) {
            if (gameState.grid[row][col] !== 1) {
                isComplete = false;
                break;
            }
        }
        if (isComplete) {
            linesToClear.push({ type: 'col', index: col });
        }
    }
    
    // Clear the lines with animation
    if (linesToClear.length > 0) {
        clearLinesWithAnimation(linesToClear);
    }
    
    return linesToClear.length;
}

// Clear lines with animation
function clearLinesWithAnimation(linesToClear) {
    // Add clearing animation class
    linesToClear.forEach(line => {
        if (line.type === 'row') {
            for (let col = 0; col < GAME_CONFIG.GRID_SIZE; col++) {
                const cell = document.querySelector(`[data-row="${line.index}"][data-col="${col}"]`);
                if (cell) cell.classList.add('clearing');
            }
        } else {
            for (let row = 0; row < GAME_CONFIG.GRID_SIZE; row++) {
                const cell = document.querySelector(`[data-row="${row}"][data-col="${line.index}"]`);
                if (cell) cell.classList.add('clearing');
            }
        }
    });
    
    // Remove blocks after animation
    setTimeout(() => {
        linesToClear.forEach(line => {
            if (line.type === 'row') {
                for (let col = 0; col < GAME_CONFIG.GRID_SIZE; col++) {
                    gameState.grid[line.index][col] = 0;
                    const cell = document.querySelector(
                        `[data-row="${line.index}"][data-col="${col}"]`
                    );
                    if (cell) {
                        cell.classList.remove('filled', 'clearing');
                        // Reset all custom styles to default empty cell appearance
                        cell.style.background = '';
                        cell.style.borderColor = '';
                        cell.style.boxShadow = '';
                    }
                }
            } else {
                for (let row = 0; row < GAME_CONFIG.GRID_SIZE; row++) {
                    gameState.grid[row][line.index] = 0;
                    const cell = document.querySelector(
                        `[data-row="${row}"][data-col="${line.index}"]`
                    );
                    if (cell) {
                        cell.classList.remove('filled', 'clearing');
                        // Reset all custom styles to default empty cell appearance
                        cell.style.background = '';
                        cell.style.borderColor = '';
                        cell.style.boxShadow = '';
                    }
                }
            }
        });

        // After rows/columns are cleared, check if any tracked golden blocks
        // have been fully cleared from the grid and award their time bonuses.
        checkGoldenBlocksCleared();
    }, 500);
}

// Check tracked golden blocks and award time bonus only when
// an entire golden block (all its cells) has been cleared.
function checkGoldenBlocksCleared() {
    if (!gameState.goldenBlocks || gameState.goldenBlocks.length === 0) return;

    const remainingBlocks = [];

    for (const block of gameState.goldenBlocks) {
        if (block.awarded) continue;

        let fullyCleared = true;
        for (const key of block.cells) {
            const [rowStr, colStr] = key.split('-');
            const row = parseInt(rowStr, 10);
            const col = parseInt(colStr, 10);
            if (gameState.grid[row][col] === 1) {
                fullyCleared = false;
                break;
            }
        }

        if (fullyCleared) {
            gameState.timeRemaining += block.bonusSeconds;
            showTimeBonusAnimation(block.bonusSeconds);
            block.awarded = true;
        } else {
            remainingBlocks.push(block);
        }
    }

    gameState.goldenBlocks = remainingBlocks;
}

// Handle line clear payout
function handleLineClear(clearedLines) {
    // Increment consecutive clears when lines are completed
    gameState.consecutiveClears += 1;
    
    // Calculate multiplier: starts at 1x, then 2x, 4x, 8x, 16x (max)
    // consecutiveClears: 1 -> 1x, 2 -> 2x, 3 -> 4x, 4 -> 8x, 5+ -> 16x
    gameState.currentMultiplier = Math.min(16, Math.pow(2, Math.max(0, gameState.consecutiveClears - 1)));
    
    gameState.linesCleared += clearedLines;
    
    const basePayout = GAME_CONFIG.LINE_PAYOUT * clearedLines;
    const payoutWithMultiplier = basePayout * gameState.currentMultiplier;
    gameState.balance += payoutWithMultiplier;

    // Golden pot: only increase when multiple lines are cleared at once
    if (clearedLines > 1) {
        gameState.potValue = Math.min(GAME_CONFIG.POT_LIMIT[Math.floor(Math.random()* 3)], gameState.potValue + clearedLines);
    }

    // If pot is full, trigger golden pot explosion
    if (gameState.potValue >= GAME_CONFIG.POT_LIMIT[Math.floor(Math.random()* 3)]) {
        triggerGoldenPotExplosion();
    }

    // Show payout animation with multiplier info
    showPayoutAnimation(payoutWithMultiplier, gameState.currentMultiplier);
}

// Show payout animation
function showPayoutAnimation(amount, multiplier = 1) {
    const animation = document.createElement('div');
    animation.className = 'payout-animation';
    if (multiplier > 1) {
        animation.textContent = `+$${amount.toFixed(3)} (${multiplier}x)`;
    } else {
        animation.textContent = `+$${amount.toFixed(3)}`;
    }
    
    document.body.appendChild(animation);
    
    setTimeout(() => {
        document.body.removeChild(animation);
    }, 2000);
}

// Show a temporary "+ X seconds" animation when a golden block
// has been fully cleared and its time bonus is awarded.
function showTimeBonusAnimation(seconds) {
    const animation = document.createElement('div');
    animation.className = 'time-bonus-animation';
    animation.textContent = `+${seconds} seconds`;

    document.body.appendChild(animation);

    setTimeout(() => {
        if (animation.parentNode) {
            animation.parentNode.removeChild(animation);
        }
    }, 1500);
}

// Block colors for visual distinction
const BLOCK_COLORS = ['#ff4444', '#4444ff', '#44ff44', '#ff8800']; // red, blue, green, orange, yellow

// Generate block options using RTP algorithm
function generateBlockOptions() {
    gameState.blockOptions = [];
    
    // Calculate current RTP ratio
    const totalSpent = GAME_CONFIG.GAME_COST;
    const totalWon = gameState.balance;
    const currentRTP = totalWon / totalSpent;
    
    // Adjust weights based on RTP
    const rtpAdjustment = GAME_CONFIG.TARGET_RTP - currentRTP;
    
    for (let i = 0; i < 5; i++) {
        const blockType = selectWeightedBlock(rtpAdjustment);
        const blockColor = BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)];
        gameState.blockOptions.push({
            id: i,
            type: blockType,
            shape: BLOCK_SHAPES[blockType],
            color: blockColor
        });
    }
    
    renderBlockOptions();
}

// Tiered difficulty system - 25 tables based on lines cleared (every 1 line for maximum progression speed)
function getDifficultyTier(linesCleared) {
    return Math.min(Math.floor(linesCleared / 1), 24); // 0-24 tiers (25 total), every 1 line
}

// Generate difficulty multipliers for each tier (0-24) - BALANCED FOR ~90% RTP
function getDifficultyMultiplierForTier(tier, blockDifficulty) {
    // More moderate scaling to reach 90% RTP target
    const tierProgress = tier / 24; // 0 to 1
    
    if (blockDifficulty <= 1.5) {
        return Math.max(0.3, 1.0 - (tierProgress * 0.6)); // Down to 0.4x
    } else if (blockDifficulty <= 2.5) {
        return Math.max(0.4, 1.0 - (tierProgress * 0.5)); // Down to 0.5x
    } else if (blockDifficulty <= 3.5) {
        return Math.max(0.5, 1.0 - (tierProgress * 0.4)); // Down to 0.6x
    } else if (blockDifficulty <= 4.5) {
        return Math.max(0.6, 1.0 - (tierProgress * 0.3)); // Down to 0.7x
    } else if (blockDifficulty <= 5.5) {
        return Math.max(0.7, 1.0 - (tierProgress * 0.2)); // Down to 0.8x
    } else if (blockDifficulty <= 6.5) {
        return Math.max(0.8, 1.0 - (tierProgress * 0.1)); // Down to 0.9x
    } else if (blockDifficulty <= 7.5) {
        return 1.0 + (tierProgress * 1.5); // Up to 2.5x
    } else if (blockDifficulty <= 8.5) {
        return 1.0 + (tierProgress * 2.5); // Up to 3.5x
    } else {
        return 1.0 + (tierProgress * 3.5); // Up to 4.5x
    }
}

// Select block based on tiered difficulty system
function selectWeightedBlock(rtpAdjustment) {
    const weights = {};
    let totalWeight = 0;
    
    // Get current difficulty tier based on lines cleared
    const difficultyTier = getDifficultyTier(gameState.linesCleared);
    
    // Calculate performance-based difficulty adjustment (reduced impact)
    const performanceMultiplier = calculatePerformanceMultiplier();
    
    Object.keys(BLOCK_SHAPES).forEach(blockType => {
        const config = BLOCK_WEIGHTS[blockType];
        const difficultyValue = (config && config.difficulty) || BLOCK_DIFFICULTY[blockType] || 1;
        let weight = applyDifficultyWeight(config ? config.base : 1, difficultyValue);
        const rtpFactor = config ? config.rtp_factor : 0;
        
        // Adjust weight based on RTP - if RTP is low, favor blocks with higher payout potential
        if (rtpAdjustment > 0) {
            weight *= (1 + rtpFactor * rtpAdjustment * 0.5); // Much more conservative
        } else {
            weight *= (1 + rtpFactor * rtpAdjustment * 0.1); // Much more conservative
        }
        
        // Apply tiered difficulty adjustment based on lines cleared
        const tierMultiplier = getDifficultyMultiplierForTier(difficultyTier, difficultyValue);
        weight *= tierMultiplier;
        
        // Apply performance-based adjustment (minimal impact)
        if (performanceMultiplier > 1) {
            // Player is performing too well, increase weight of harder blocks
            weight *= (1 + (difficultyValue - 1) * (performanceMultiplier - 1) * 0.05); // Much smaller impact
        } else if (performanceMultiplier < 1) {
            // Player is struggling, decrease weight of harder blocks
            weight *= (1 - (difficultyValue - 1) * (1 - performanceMultiplier) * 0.03); // Much smaller impact
        }
        
        weights[blockType] = Math.max(weight, 0.1); // Ensure minimum weight
        totalWeight += weights[blockType];
    });
    
    const random = Math.random() * totalWeight;
    let currentWeight = 0;
    
    for (const [blockType, weight] of Object.entries(weights)) {
        currentWeight += weight;
        if (random <= currentWeight) {
            return blockType;
        }
    }
    
    return 'single'; // Fallback
}

// Calculate performance multiplier based on recent games
function calculatePerformanceMultiplier() {
    if (gameState.recentPerformance.length < 3) {
        return 1.0; // Not enough data
    }
    
    // Calculate average RTP of recent games
    const recentRTP = gameState.recentPerformance.reduce((sum, game) => sum + game.rtp, 0) / gameState.recentPerformance.length;
    
    // If recent RTP is significantly above target, increase difficulty
    if (recentRTP > GAME_CONFIG.TARGET_RTP + 0.05) {
        return Math.min(2.0, 1 + (recentRTP - GAME_CONFIG.TARGET_RTP) * 3);
    }
    // If recent RTP is significantly below target, decrease difficulty
    else if (recentRTP < GAME_CONFIG.TARGET_RTP - 0.05) {
        return Math.max(0.5, 1 - (GAME_CONFIG.TARGET_RTP - recentRTP) * 2);
    }
    
    return 1.0;
}

// Render block options
function renderBlockOptions() {
    const container = document.getElementById('blockOptions');
    container.innerHTML = '';
    
    // If golden batch is active, all blocks will be golden when placed
    const goldenBatchActive = gameState.goldenBatchActive && gameState.goldenBatchBlocksRemaining > 0;
    
    gameState.blockOptions.forEach(block => {
        if (!block) return;
        const option = document.createElement('div');
        option.className = 'block-option';
        option.dataset.blockId = block.id;
        
        // Show blocks as golden if golden batch is active (any block placed will be golden)
        const preview = createBlockPreview(block.shape, block.color, goldenBatchActive);
        option.appendChild(preview);
        
        option.addEventListener('click', () => selectBlock(block));
        container.appendChild(option);
    });
}

// Create visual preview of block
function createBlockPreview(shape, color, isGolden = false) {
    const preview = document.createElement('div');
    preview.className = 'block-preview';
    preview.style.gridTemplateColumns = `repeat(${shape[0].length}, 1fr)`;
    preview.style.gridTemplateRows = `repeat(${shape.length}, 1fr)`;
    
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            const cell = document.createElement('div');
            if (shape[r][c] === 1) {
                cell.className = 'block-cell';
                if (isGolden) {
                    // Golden visual style for golden batch blocks
                    cell.style.background = 'linear-gradient(135deg, #ffd700, #ffa500)';
                    cell.style.borderColor = '#ffec8b';
                    cell.style.boxShadow = '0 0 6px rgba(255, 215, 0, 0.9), inset 0 1px 2px rgba(255, 255, 255, 0.6)';
                } else {
                    // Normal color
                    cell.style.background = `linear-gradient(135deg, ${color}, ${adjustBrightness(color, -20)})`;
                    cell.style.borderColor = adjustBrightness(color, 20);
                    cell.style.boxShadow = `0 0 4px ${color}66, inset 0 1px 2px rgba(255, 255, 255, 0.3)`;
                }
            } else {
                cell.style.width = '20px';
                cell.style.height = '20px';
            }
            preview.appendChild(cell);
        }
    }
    
    return preview;
}

// Utility function to adjust color brightness
function adjustBrightness(color, amount) {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * amount);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

// Select a block
function selectBlock(block) {
    gameState.selectedBlock = block;
    
    // Update UI
    document.querySelectorAll('.block-option').forEach(option => {
        option.classList.remove('selected');
    });
    
    document.querySelector(`[data-block-id="${block.id}"]`).classList.add('selected');
}

// Remove used block and, once all 5 are used, generate a new set and decrease timer
function removeUsedBlock() {
    if (!gameState.selectedBlock) return;
    
    const usedIndex = gameState.selectedBlock.id;
    
    // Mark this block slot as used (empty)
    gameState.blockOptions[usedIndex] = null;
    gameState.blocksPlacedInSet += 1;
    gameState.selectedBlock = null;

    // If all 5 blocks are placed, reset timer (minus one second) and spawn a new set
    const remainingBlocks = gameState.blockOptions.filter(b => b !== null);
    if (gameState.blocksPlacedInSet >= 5 || remainingBlocks.length === 0) {
        // Decrease the per-cycle time limit by 1, down to a minimum of 0
        gameState.currentTurnTimeLimit = Math.max(0, gameState.currentTurnTimeLimit - 1);
        gameState.timeRemaining = gameState.currentTurnTimeLimit;

        // Generate a fresh set of 5 blocks
        const totalSpent = GAME_CONFIG.GAME_COST;
        const totalWon = gameState.balance;
        const currentRTP = totalWon / totalSpent;
        const rtpAdjustment = GAME_CONFIG.TARGET_RTP - currentRTP;

        gameState.blockOptions = [];
        for (let i = 0; i < 5; i++) {
            const blockType = selectWeightedBlock(rtpAdjustment);
            const blockColor = BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)];
            gameState.blockOptions.push({
                id: i,
                type: blockType,
                shape: BLOCK_SHAPES[blockType],
                color: blockColor
            });
        }

        gameState.blocksPlacedInSet = 0;
    }

    renderBlockOptions();
}

// Check if game is over (no valid moves)
function isGameOver() {
    for (const block of gameState.blockOptions) {
        if (!block) continue;
        for (let row = 0; row < GAME_CONFIG.GRID_SIZE; row++) {
            for (let col = 0; col < GAME_CONFIG.GRID_SIZE; col++) {
                if (canPlaceBlock(block.shape, row, col)) {
                    return false;
                }
            }
        }
    }
    return true;
}

// End the game
function endGame() {
    if (gameState.isGameOver) {
        stopTurnTimer();
        return;
    }
    
    gameState.isGameOver = true;
    stopTurnTimer();
    
    // Track game performance
    trackGamePerformance();
    
    document.getElementById('gameOverOverlay').style.display = 'flex';
    document.getElementById('finalBalance').textContent = gameState.balance.toFixed(3);
}

// Track performance of completed game
function trackGamePerformance() {
    const gameWon = gameState.balance;
    const gameRTP = gameWon / GAME_CONFIG.GAME_COST;
    
    // Add to recent performance (keep last 10 games)
    gameState.recentPerformance.push({
        rtp: gameRTP,
        linesCleared: gameState.linesCleared,
        finalBalance: gameState.balance
    });
    
    if (gameState.recentPerformance.length > 10) {
        gameState.recentPerformance.shift();
    }
    
    // Update overall stats
    gameState.totalGamesPlayed++;
    gameState.totalAmountWagered += GAME_CONFIG.GAME_COST;
    gameState.totalAmountWon += gameWon;
}

// Start new game
function startNewGame() {
    if (gameState.balance < GAME_CONFIG.GAME_COST) {
        alert('Insufficient balance to start a new game!');
        return;
    }
    
    stopTurnTimer();
    
    gameState.balance -= GAME_CONFIG.GAME_COST;
    gameState.currentMultiplier = 1;
    gameState.linesCleared = 0;
    gameState.selectedBlock = null;
    gameState.isGameOver = false;
    gameState.consecutiveClears = 0;
    gameState.roundStartBalance = gameState.balance;
    gameState.currentTurnTimeLimit = GAME_CONFIG.TURN_TIME_LIMIT;
    gameState.timeRemaining = gameState.currentTurnTimeLimit;
    gameState.blocksPlacedInSet = 0;
    gameState.potValue = 0;
    gameState.goldenCells = new Set();
    gameState.goldenBatchActive = false;
    gameState.goldenBatchBlocksRemaining = 0;
    gameState.goldenBlocks = [];
    
    document.getElementById('gameOverOverlay').style.display = 'none';
    
    createGrid();
    generateBlockOptions();
    
    // Check if game is immediately over (very rare but possible)
    if (isGameOver()) {
        endGame();
    } else {
        startTurnTimer();
    }
    
    updateUI();
}

// Update UI elements
function updateUI() {
    document.getElementById('balance').textContent = gameState.balance.toFixed(3);
    document.getElementById('multiplier').textContent = gameState.currentMultiplier;
    document.getElementById('linesCleared').textContent = gameState.linesCleared;
    
    // Timer element now shows the main turn countdown (15 → 0)
    const timerElement = document.getElementById('timer');
    if (timerElement) {
        timerElement.textContent = `${Math.max(0, Math.ceil(gameState.timeRemaining))}s`;
    }

    // Update golden pot UI
    const potElement = document.getElementById('potValue');
    if (potElement) {
        potElement.textContent = `${gameState.potValue}/${GAME_CONFIG.POT_LIMIT[Math.floor(Math.random()* 3)]}`;
    }
}

// Handle keyboard input
function handleKeyPress(event) {
    if (event.key >= '1' && event.key <= '5') {
        const blockIndex = parseInt(event.key) - 1;
        if (gameState.blockOptions[blockIndex]) {
            selectBlock(gameState.blockOptions[blockIndex]);
        }
    }
}

// Auto play functionality
function toggleAutoPlay() {
    gameState.autoPlay = !gameState.autoPlay;
    const btn = document.getElementById('autoPlayBtn');
    
    if (gameState.autoPlay) {
        btn.textContent = 'Stop Auto';
        btn.classList.add('active');
        autoPlayLoop();
    } else {
        btn.textContent = 'Auto Play';
        btn.classList.remove('active');
    }
}

// Auto play loop
function autoPlayLoop() {
    if (!gameState.autoPlay || gameState.isGameOver) return;
    
    // Simple AI: try to place blocks that complete lines
    let bestMove = findBestMove();
    
    if (bestMove) {
        selectBlock(bestMove.block);
        setTimeout(() => {
            handleCellClick(bestMove.row, bestMove.col);
            setTimeout(autoPlayLoop, 1000);
        }, 500);
    } else {
        gameState.autoPlay = false;
        toggleAutoPlay();
    }
}

// Advanced AI: Find best move for auto play
function findBestMove() {
    let bestScore = -Infinity;
    let bestMove = null;
    
    // Evaluate all possible moves for all blocks
    for (const block of gameState.blockOptions) {
        for (let row = 0; row < GAME_CONFIG.GRID_SIZE; row++) {
            for (let col = 0; col < GAME_CONFIG.GRID_SIZE; col++) {
                if (canPlaceBlock(block.shape, row, col)) {
                    const score = evaluateMove(block.shape, row, col, block);
                    if (score > bestScore) {
                        bestScore = score;
                        bestMove = { block, row, col, score };
                    }
                }
            }
        }
    }
    
    return bestMove;
}

// Advanced move evaluation with multiple strategic factors
function evaluateMove(shape, startRow, startCol, block) {
    // Create temporary grid
    const tempGrid = gameState.grid.map(row => [...row]);
    
    // Place block on temp grid
    const placedCells = [];
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c] === 1) {
                tempGrid[startRow + r][startCol + c] = 1;
                placedCells.push({ row: startRow + r, col: startCol + c });
            }
        }
    }
    
    let score = 0;
    
    // 1. IMMEDIATE LINE COMPLETION (Highest Priority)
    const completedLines = countCompletedLines(tempGrid);
    score += completedLines * 1000; // Very high reward for completing lines
    
    // 2. NEAR-COMPLETION BONUS (Lines close to being completed)
    score += evaluateNearCompletions(tempGrid) * 100;
    
    // 3. STRATEGIC POSITIONING
    score += evaluateStrategicPositioning(tempGrid, placedCells) * 50;
    
    // 4. SPACE EFFICIENCY (Avoid creating unreachable holes)
    score += evaluateSpaceEfficiency(tempGrid, placedCells) * 30;
    
    // 5. FUTURE MOVE POTENTIAL (Keep options open)
    score += evaluateFuturePotential(tempGrid, block) * 20;
    
    // 6. EDGE AND CORNER PREFERENCE (Better for line completion)
    score += evaluateEdgeCornerBonus(placedCells) * 15;
    
    // 7. DENSITY OPTIMIZATION (Fill gaps efficiently)
    score += evaluateDensityOptimization(tempGrid, placedCells) * 25;
    
    // 8. AVOID CREATING ISOLATED HOLES
    score -= evaluateIsolatedHoles(tempGrid) * 200;
    
    return score;
}

// Count completed lines after move
function countCompletedLines(grid) {
    let completedLines = 0;
    
    // Check rows
    for (let row = 0; row < GAME_CONFIG.GRID_SIZE; row++) {
        if (grid[row].every(cell => cell === 1)) {
            completedLines++;
        }
    }
    
    // Check columns
    for (let col = 0; col < GAME_CONFIG.GRID_SIZE; col++) {
        let isComplete = true;
        for (let row = 0; row < GAME_CONFIG.GRID_SIZE; row++) {
            if (grid[row][col] !== 1) {
                isComplete = false;
                break;
            }
        }
        if (isComplete) completedLines++;
    }
    
    return completedLines;
}

// Evaluate lines that are close to completion
function evaluateNearCompletions(grid) {
    let score = 0;
    
    // Check rows
    for (let row = 0; row < GAME_CONFIG.GRID_SIZE; row++) {
        const filledCells = grid[row].filter(cell => cell === 1).length;
        if (filledCells >= 6) score += (filledCells - 5) * 2; // Bonus for nearly complete rows
    }
    
    // Check columns
    for (let col = 0; col < GAME_CONFIG.GRID_SIZE; col++) {
        let filledCells = 0;
        for (let row = 0; row < GAME_CONFIG.GRID_SIZE; row++) {
            if (grid[row][col] === 1) filledCells++;
        }
        if (filledCells >= 6) score += (filledCells - 5) * 2; // Bonus for nearly complete columns
    }
    
    return score;
}

// Evaluate strategic positioning (connecting to existing blocks)
function evaluateStrategicPositioning(grid, placedCells) {
    let score = 0;
    
    for (const cell of placedCells) {
        let adjacentFilled = 0;
        
        // Check all 4 directions
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of directions) {
            const newRow = cell.row + dr;
            const newCol = cell.col + dc;
            
            if (newRow >= 0 && newRow < GAME_CONFIG.GRID_SIZE && 
                newCol >= 0 && newCol < GAME_CONFIG.GRID_SIZE && 
                grid[newRow][newCol] === 1) {
                adjacentFilled++;
            }
        }
        
        score += adjacentFilled; // Bonus for connecting to existing blocks
    }
    
    return score;
}

// Evaluate space efficiency (avoid creating unreachable areas)
function evaluateSpaceEfficiency(grid, placedCells) {
    let score = 0;
    
    // Prefer moves that don't create small isolated empty spaces
    for (const cell of placedCells) {
        const surroundingEmpty = countSurroundingEmpty(grid, cell.row, cell.col);
        if (surroundingEmpty <= 2) score += 3; // Bonus for filling tight spaces
    }
    
    return score;
}

// Count empty cells around a position
function countSurroundingEmpty(grid, row, col) {
    let emptyCount = 0;
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    
    for (const [dr, dc] of directions) {
        const newRow = row + dr;
        const newCol = col + dc;
        
        if (newRow >= 0 && newRow < GAME_CONFIG.GRID_SIZE && 
            newCol >= 0 && newCol < GAME_CONFIG.GRID_SIZE && 
            grid[newRow][newCol] === 0) {
            emptyCount++;
        }
    }
    
    return emptyCount;
}

// Evaluate future move potential (keep options open)
function evaluateFuturePotential(grid, currentBlock) {
    let score = 0;
    
    // Simulate remaining blocks and count possible placements
    const remainingBlocks = gameState.blockOptions.filter(b => b.id !== currentBlock.id);
    
    for (const block of remainingBlocks) {
        let possiblePlacements = 0;
        
        for (let row = 0; row < GAME_CONFIG.GRID_SIZE; row++) {
            for (let col = 0; col < GAME_CONFIG.GRID_SIZE; col++) {
                if (canPlaceBlockOnGrid(block.shape, row, col, grid)) {
                    possiblePlacements++;
                }
            }
        }
        
        score += Math.min(possiblePlacements, 10); // Cap to avoid over-weighting
    }
    
    return score;
}

// Check if block can be placed on a specific grid
function canPlaceBlockOnGrid(shape, startRow, startCol, grid) {
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c] === 1) {
                const targetRow = startRow + r;
                const targetCol = startCol + c;
                
                if (targetRow < 0 || targetRow >= GAME_CONFIG.GRID_SIZE ||
                    targetCol < 0 || targetCol >= GAME_CONFIG.GRID_SIZE ||
                    grid[targetRow][targetCol] === 1) {
                    return false;
                }
            }
        }
    }
    return true;
}

// Evaluate edge and corner placement bonus
function evaluateEdgeCornerBonus(placedCells) {
    let score = 0;
    
    for (const cell of placedCells) {
        // Corner bonus
        if ((cell.row === 0 || cell.row === GAME_CONFIG.GRID_SIZE - 1) && 
            (cell.col === 0 || cell.col === GAME_CONFIG.GRID_SIZE - 1)) {
            score += 2;
        }
        // Edge bonus
        else if (cell.row === 0 || cell.row === GAME_CONFIG.GRID_SIZE - 1 || 
                 cell.col === 0 || cell.col === GAME_CONFIG.GRID_SIZE - 1) {
            score += 1;
        }
    }
    
    return score;
}

// Evaluate density optimization (fill existing clusters)
function evaluateDensityOptimization(grid, placedCells) {
    let score = 0;
    
    for (const cell of placedCells) {
        // Count filled cells in 3x3 area around placement
        let localDensity = 0;
        
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const checkRow = cell.row + dr;
                const checkCol = cell.col + dc;
                
                if (checkRow >= 0 && checkRow < GAME_CONFIG.GRID_SIZE && 
                    checkCol >= 0 && checkCol < GAME_CONFIG.GRID_SIZE && 
                    grid[checkRow][checkCol] === 1) {
                    localDensity++;
                }
            }
        }
        
        score += localDensity; // Bonus for high local density
    }
    
    return score;
}

// Evaluate and penalize isolated holes creation
function evaluateIsolatedHoles(grid) {
    let isolatedHoles = 0;
    
    for (let row = 1; row < GAME_CONFIG.GRID_SIZE - 1; row++) {
        for (let col = 1; col < GAME_CONFIG.GRID_SIZE - 1; col++) {
            if (grid[row][col] === 0) {
                // Check if this empty cell is surrounded by filled cells
                let surroundedCount = 0;
                const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
                
                for (const [dr, dc] of directions) {
                    if (grid[row + dr][col + dc] === 1) {
                        surroundedCount++;
                    }
                }
                
                if (surroundedCount >= 3) {
                    isolatedHoles++;
                }
            }
        }
    }
    
    return isolatedHoles;
}

// RTP Simulation functionality - 100 games with golden pot and RTP tracking
function runRTPSimulation() {
    console.log('\n========================================');
    console.log('  BLOCK RUSH - 100 GAME RTP SIMULATION');
    console.log('  (With Golden Pot Feature)              ');
    console.log('========================================\n');
    
    const TOTAL_GAMES = 10000;
    const COST_PER_GAME = 1.00;
    
    let totalWagered = 0;
    let totalWon = 0;
    let totalGoldenPotTriggered = 0;
    let totalGoldenWinnings = 0;
    const gameResults = [];
    
    console.log(`Running ${TOTAL_GAMES} games at $${COST_PER_GAME.toFixed(2)} per game...\n`);
    console.log('Game# | Wager | Winnings | Lines | Gold | RTP (Game) | Running RTP');
    console.log('------|-------|----------|-------|------|------------|----------');
    
    for (let gameNum = 1; gameNum <= TOTAL_GAMES; gameNum++) {
        try {
            const wager = COST_PER_GAME;
            
            // Simulate the game with golden pot tracking
            const result = simpleGameSimulation();
            const winnings = result.balance;
            const goldenTriggered = result.goldenPotTriggered ? 'YES' : 'no';
            
            // Track totals
            totalWagered += wager;
            totalWon += winnings;
            if (result.goldenPotTriggered) {
                totalGoldenPotTriggered++;
                totalGoldenWinnings += result.goldenPotBonus;
            }
            
            // Calculate RTP
            const gameRTP = winnings > 0 ? (winnings / wager) * 100 : 0;
            const runningRTP = totalWagered > 0 ? (totalWon / totalWagered) * 100 : 0;
            
            gameResults.push({
                game: gameNum,
                wager,
                winnings,
                lines: result.linesCleared,
                goldenTriggered: result.goldenPotTriggered,
                goldenBonus: result.goldenPotBonus,
                rtp: gameRTP,
                runningRTP
            });
            
            // Log every game
            console.log(
                `${String(gameNum).padStart(5, ' ')} | $${wager.toFixed(2)} | $${winnings.toFixed(4)} | ${String(result.linesCleared).padStart(5, ' ')} | ${goldenTriggered.padEnd(4, ' ')} | ${gameRTP.toFixed(2).padStart(9, ' ')}% | ${runningRTP.toFixed(2)}%`
            );
        } catch (error) {
            console.error(`✗ Error in game ${gameNum}:`, error);
            totalWagered += COST_PER_GAME;
        }
    }
    
    // Calculate final stats
    const finalRTP = totalWagered > 0 ? (totalWon / totalWagered) * 100 : 0;
    const avgWinPerGame = totalWon / TOTAL_GAMES;
    const avgLinesPerGame = gameResults.reduce((sum, g) => sum + g.lines, 0) / TOTAL_GAMES;
    const netProfit = totalWon - totalWagered;
    const baseWinnings = totalWon - totalGoldenWinnings;
    const baseRTP = totalWagered > 0 ? (baseWinnings / totalWagered) * 100 : 0;
    const goldenRTPBoost = finalRTP - baseRTP;
    
    // Final summary
    console.log('\n========================================');
    console.log('        FINAL SIMULATION SUMMARY');
    console.log('========================================\n');
    console.log('WAGERING STATS:');
    console.log(`  Total Games Played:       ${TOTAL_GAMES}`);
    console.log(`  Total Amount Wagered:     $${totalWagered.toFixed(2)}`);
    console.log(`  Total Amount Won:         $${totalWon.toFixed(2)}`);
    console.log(`  Net Profit/Loss:          $${netProfit.toFixed(2)}`);
    console.log(`  Average Win per Game:     $${avgWinPerGame.toFixed(4)}`);
    console.log(`  Average Lines per Game:   ${avgLinesPerGame.toFixed(2)}`);
    
    console.log('\nRTP PERFORMANCE:');
    console.log(`  Final RTP:                ${finalRTP.toFixed(2)}%`);
    console.log(`  Target RTP:               ${(GAME_CONFIG.TARGET_RTP * 100).toFixed(2)}%`);
    console.log(`  RTP Variance:             ${(finalRTP - (GAME_CONFIG.TARGET_RTP * 100)).toFixed(2)}%`);
    console.log(`  Base RTP (w/o golden):    ${baseRTP.toFixed(2)}%`);
    console.log(`  Golden RTP Boost:         +${goldenRTPBoost.toFixed(2)}%`);
    
    console.log('\nGOLDEN POT STATS:');
    console.log(`  Golden Pot Triggered:     ${totalGoldenPotTriggered}x (${((totalGoldenPotTriggered/TOTAL_GAMES)*100).toFixed(1)}% of games)`);
    console.log(`  Golden Pot Winnings:      $${totalGoldenWinnings.toFixed(2)}`);
    console.log(`  Avg Golden Bonus:         $${totalGoldenPotTriggered > 0 ? (totalGoldenWinnings/totalGoldenPotTriggered).toFixed(4) : '0.0000'}`);
    
    console.log('\n========================================\n');
    
    return {
        totalGames: TOTAL_GAMES,
        totalWagered,
        totalWon,
        finalRTP,
        avgWinPerGame,
        avgLinesPerGame,
        netProfit,
        goldenPotTriggered: totalGoldenPotTriggered,
        goldenWinnings: totalGoldenWinnings,
        gameResults
    };
}

// Simple, isolated 100-game simulation with golden pot tracking
function simpleGameSimulation() {
    // Create isolated game state
    const sim = {
        grid: Array(GAME_CONFIG.GRID_SIZE).fill().map(() => Array(GAME_CONFIG.GRID_SIZE).fill(0)),
        balance: 0, // Start with $0 (after paying $1 to play)
        currentMultiplier: 1,
        linesCleared: 0,
        consecutiveClears: 0,
        potValue: 0, // Golden pot tracker
        goldenBatchActive: false,
        goldenBatchBlocksRemaining: 0,
        goldenBlocks: [],
        blockOptions: [],
        moves: 0,
        goldenPotTriggered: false,
        goldenPotBonus: 0
    };
    
    // Generate initial 3 blocks
    generateSimulationBlocks(sim);
    
    const maxMoves = 1000;
    
    // Play game with AI
    while (!isSimulationGameOver(sim) && sim.moves < maxMoves) {
        const bestMove = findBestSimulationMove(sim);
        if (!bestMove) break;
        
        // Place block
        placeSimulationBlock(sim, bestMove.block.shape, bestMove.row, bestMove.col);
        
        // Check lines and clear
        const clearedLines = checkAndClearSimulationLines(sim);
        if (clearedLines > 0) {
            sim.consecutiveClears += 1;
            sim.currentMultiplier = Math.min(16, Math.pow(2, sim.consecutiveClears - 1));
            const basePayout = GAME_CONFIG.LINE_PAYOUT * clearedLines;
            const payout = basePayout * sim.currentMultiplier;
            sim.balance += payout;
            sim.linesCleared += clearedLines;
            
            // Golden pot mechanic: accumulate for multi-line clears
            if (clearedLines > 1) {
                sim.potValue = Math.min(GAME_CONFIG.POT_LIMIT[Math.floor(Math.random()* 3)], sim.potValue + clearedLines);
                
                // Pot full? Trigger golden batch
                if (sim.potValue >= GAME_CONFIG.POT_LIMIT[Math.floor(Math.random()* 3)]) {
                    sim.goldenBatchActive = true;
                    sim.goldenBatchBlocksRemaining = 5;
                    sim.goldenPotTriggered = true;
                    sim.goldenPotBonus += 0.15; // Golden pot trigger bonus
                    sim.potValue = 0; // Reset pot
                }
            }
            
            // Apply golden batch bonus if active
            if (sim.goldenBatchActive && sim.goldenBatchBlocksRemaining > 0) {
                const goldenBonus = payout * 0.30; // 30% bonus per golden block placement
                sim.balance += goldenBonus;
                sim.goldenPotBonus += goldenBonus;
                sim.goldenBatchBlocksRemaining -= 1;
                if (sim.goldenBatchBlocksRemaining <= 0) {
                    sim.goldenBatchActive = false;
                }
            }
        } else {
            sim.consecutiveClears = 0;
            sim.currentMultiplier = 1;
        }
        
        // Remove used block and generate new one
        const usedIndex = bestMove.block.id;
        const newBlockType = selectSimulationWeightedBlock(sim);
        sim.blockOptions[usedIndex] = {
            id: usedIndex,
            type: newBlockType,
            shape: BLOCK_SHAPES[newBlockType]
        };
        
        sim.moves++;
    }
    
    return {
        balance: sim.balance,
        linesCleared: sim.linesCleared,
        moves: sim.moves,
        goldenPotTriggered: sim.goldenPotTriggered,
        goldenPotBonus: sim.goldenPotBonus
    };
}

// Generate initial blocks for simulation
function generateSimulationBlocks(sim) {
    sim.blockOptions = [];
    for (let i = 0; i < 3; i++) {
        const blockType = selectSimulationWeightedBlock(sim);
        sim.blockOptions.push({
            id: i,
            type: blockType,
            shape: BLOCK_SHAPES[blockType]
        });
    }
}

// Select weighted block for simulation
function selectSimulationWeightedBlock(sim) {
    const weights = {};
    let totalWeight = 0;
    
    Object.keys(BLOCK_SHAPES).forEach(blockType => {
        const config = BLOCK_WEIGHTS[blockType];
        const difficulty = config ? config.difficulty : 1;
        let weight = config ? config.base : 1;
        
        // Simple weight adjustment
        weight *= (1 + difficulty * 0.1);
        
        weights[blockType] = Math.max(weight, 0.1);
        totalWeight += weights[blockType];
    });
    
    const random = Math.random() * totalWeight;
    let currentWeight = 0;
    
    for (const [blockType, weight] of Object.entries(weights)) {
        currentWeight += weight;
        if (random <= currentWeight) {
            return blockType;
        }
    }
    
    return 'single';
}

// Check if simulation game is over
function isSimulationGameOver(sim) {
    for (const block of sim.blockOptions) {
        if (!block) continue;
        for (let row = 0; row < GAME_CONFIG.GRID_SIZE; row++) {
            for (let col = 0; col < GAME_CONFIG.GRID_SIZE; col++) {
                if (canPlaceSimulationBlock(sim, block.shape, row, col)) {
                    return false;
                }
            }
        }
    }
    return true;
}

// Find best move for simulation
function findBestSimulationMove(sim) {
    let bestScore = -Infinity;
    let bestMove = null;
    
    for (const block of sim.blockOptions) {
        if (!block) continue;
        for (let row = 0; row < GAME_CONFIG.GRID_SIZE; row++) {
            for (let col = 0; col < GAME_CONFIG.GRID_SIZE; col++) {
                if (canPlaceSimulationBlock(sim, block.shape, row, col)) {
                    const score = evaluateSimulationMove(sim, block.shape, row, col);
                    if (score > bestScore) {
                        bestScore = score;
                        bestMove = { block, row, col };
                    }
                }
            }
        }
    }
    
    return bestMove;
}

// Evaluate move for simulation
function evaluateSimulationMove(sim, shape, startRow, startCol) {
    const tempGrid = sim.grid.map(row => [...row]);
    const placedCells = [];
    
    // Place on temp grid
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c] === 1) {
                tempGrid[startRow + r][startCol + c] = 1;
                placedCells.push({ row: startRow + r, col: startCol + c });
            }
        }
    }
    
    let score = 0;
    
    // Priority 1: Complete lines
    const completedLines = countSimulationCompletedLines(tempGrid);
    score += completedLines * 1000;
    
    // Priority 2: Nearly complete lines
    for (let row = 0; row < GAME_CONFIG.GRID_SIZE; row++) {
        const filled = tempGrid[row].filter(c => c === 1).length;
        if (filled >= 6) score += (filled - 5) * 100;
    }
    for (let col = 0; col < GAME_CONFIG.GRID_SIZE; col++) {
        let filled = 0;
        for (let row = 0; row < GAME_CONFIG.GRID_SIZE; row++) {
            if (tempGrid[row][col] === 1) filled++;
        }
        if (filled >= 6) score += (filled - 5) * 100;
    }
    
    // Priority 3: Connect to existing blocks
    for (const cell of placedCells) {
        let adjacent = 0;
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nr = cell.row + dr;
            const nc = cell.col + dc;
            if (nr >= 0 && nr < GAME_CONFIG.GRID_SIZE && nc >= 0 && nc < GAME_CONFIG.GRID_SIZE && tempGrid[nr][nc] === 1) {
                adjacent++;
            }
        }
        score += adjacent * 50;
    }
    
    // Priority 4: Avoid isolated holes
    let isolated = 0;
    for (let row = 1; row < GAME_CONFIG.GRID_SIZE - 1; row++) {
        for (let col = 1; col < GAME_CONFIG.GRID_SIZE - 1; col++) {
            if (tempGrid[row][col] === 0) {
                let surrounded = 0;
                for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                    if (tempGrid[row + dr][col + dc] === 1) surrounded++;
                }
                if (surrounded >= 3) isolated++;
            }
        }
    }
    score -= isolated * 200;
    
    return score;
}

// Count completed lines in simulation
function countSimulationCompletedLines(grid) {
    let count = 0;
    for (let row = 0; row < GAME_CONFIG.GRID_SIZE; row++) {
        if (grid[row].every(c => c === 1)) count++;
    }
    for (let col = 0; col < GAME_CONFIG.GRID_SIZE; col++) {
        let complete = true;
        for (let row = 0; row < GAME_CONFIG.GRID_SIZE; row++) {
            if (grid[row][col] !== 1) {
                complete = false;
                break;
            }
        }
        if (complete) count++;
    }
    return count;
}

// Can place block in simulation
function canPlaceSimulationBlock(sim, shape, startRow, startCol) {
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c] === 1) {
                const targetRow = startRow + r;
                const targetCol = startCol + c;
                if (targetRow < 0 || targetRow >= GAME_CONFIG.GRID_SIZE || targetCol < 0 || targetCol >= GAME_CONFIG.GRID_SIZE || sim.grid[targetRow][targetCol] === 1) {
                    return false;
                }
            }
        }
    }
    return true;
}

// Place block in simulation
function placeSimulationBlock(sim, shape, startRow, startCol) {
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c] === 1) {
                sim.grid[startRow + r][startCol + c] = 1;
            }
        }
    }
}

// Check and clear lines in simulation
function checkAndClearSimulationLines(sim) {
    const toClear = [];
    
    for (let row = 0; row < GAME_CONFIG.GRID_SIZE; row++) {
        if (sim.grid[row].every(c => c === 1)) {
            toClear.push({ type: 'row', index: row });
        }
    }
    
    for (let col = 0; col < GAME_CONFIG.GRID_SIZE; col++) {
        let complete = true;
        for (let row = 0; row < GAME_CONFIG.GRID_SIZE; row++) {
            if (sim.grid[row][col] !== 1) {
                complete = false;
                break;
            }
        }
        if (complete) {
            toClear.push({ type: 'col', index: col });
        }
    }
    
    // Clear lines
    for (const line of toClear) {
        if (line.type === 'row') {
            for (let col = 0; col < GAME_CONFIG.GRID_SIZE; col++) {
                sim.grid[line.index][col] = 0;
            }
        } else {
            for (let row = 0; row < GAME_CONFIG.GRID_SIZE; row++) {
                sim.grid[row][line.index] = 0;
            }
        }
    }
    
    return toClear.length;
}


// Initialize game when page loads
document.addEventListener('DOMContentLoaded', initGame);
