# Block Rush - Block Weight Design Document

## Overview
This document details the weight system for all 22 block types in Block Rush. Weights determine the probability of each block appearing in the game, and are dynamically adjusted based on RTP performance and game difficulty progression.

---

## Block Weight Summary Table

| Block Type | Category | Shape | Difficulty | Base Weight | RTP Factor | Appearance Rate* |
|---|---|---|---|---|---|---|
| **single** | Basic | 1×1 | 1 | **88** | 0.3 | ~48% |
| **double** | Basic | 1×2 | 1 | **16** | 0.4 | ~9% |
| **double_vertical** | Basic | 2×1 | 1 | **16** | 0.4 | ~9% |
| **I_piece** | Classic | 1×4 | 3 | 9 | 1.2 | ~5% |
| **I_piece_vertical** | Classic | 4×1 | 3 | 9 | 1.2 | ~5% |
| **O_piece** | Classic | 2×2 | 3 | 11 | 0.7 | ~6% |
| **T_piece** | Classic | T-shape | 4 | 10 | 1.0 | ~3% |
| **T_piece_rotated1** | Classic | T-shape (90°) | 4 | 10 | 1.0 | ~3% |
| **T_piece_rotated2** | Classic | T-shape (180°) | 4 | 10 | 1.0 | ~3% |
| **T_piece_rotated3** | Classic | T-shape (270°) | 4 | 10 | 1.0 | ~3% |
| **L_piece** | Classic | L-shape | 4 | 9 | 1.1 | ~2.5% |
| **L_piece_rotated1** | Classic | L-shape (90°) | 4 | 9 | 1.1 | ~2.5% |
| **L_piece_rotated2** | Classic | L-shape (180°) | 4 | 9 | 1.1 | ~2.5% |
| **L_piece_rotated3** | Classic | L-shape (270°) | 4 | 9 | 1.1 | ~2.5% |
| **J_piece** | Classic | J-shape | 4 | 9 | 1.1 | ~2.5% |
| **J_piece_rotated1** | Classic | J-shape (90°) | 4 | 9 | 1.1 | ~2.5% |
| **J_piece_rotated2** | Classic | J-shape (180°) | 4 | 9 | 1.1 | ~2.5% |
| **J_piece_rotated3** | Classic | J-shape (270°) | 4 | 9 | 1.1 | ~2.5% |
| **S_piece** | Classic | S-shape | 4 | 8 | 1.3 | ~2% |
| **S_piece_vertical** | Classic | S-shape (vertical) | 4 | 8 | 1.3 | ~2% |
| **Z_piece** | Classic | Z-shape | 4 | 8 | 1.3 | ~2% |
| **Z_piece_vertical** | Classic | Z-shape (vertical) | 4 | 8 | 1.3 | ~2% |

*Appearance rates shown are baseline (at game start with neutral RTP). These vary dynamically based on RTP performance and game difficulty tier.

---

## Weight Categories

### Category 1: Basic Blocks (Difficulty 1)
These are the simplest blocks, appearing most frequently early in games.

```
Single (1×1):              O
  Base Weight: 88
  RTP Factor: 0.3
  Usage: High-frequency starter blocks
  Strategic Value: Low - used to fill small gaps

Double (1×2):             O O
  Base Weight: 16
  RTP Factor: 0.4
  Usage: Frequent early-game filler
  Strategic Value: Low-Medium - horizontal gaps

Double Vertical (2×1):    O
                          O
  Base Weight: 16
  RTP Factor: 0.4
  Usage: Frequent early-game filler
  Strategic Value: Low-Medium - vertical gaps

Total Basic Weight: 120 (out of ~183 baseline)
Baseline Appearance: ~66% of early-game blocks
```

### Category 2: Intermediate Blocks (Difficulty 3)
Moderately challenging blocks that require better placement strategy.

```
I-Piece (1×4):            O O O O
  Base Weight: 9
  RTP Factor: 1.2 (HIGH - good for RTP recovery)
  Usage: Strategic line completion
  Strategic Value: High - fills entire rows/columns

I-Piece Vertical (4×1):   O
                          O
                          O
                          O
  Base Weight: 9
  RTP Factor: 1.2 (HIGH - good for RTP recovery)
  Usage: Strategic column completion
  Strategic Value: High - fills entire columns

O-Piece (2×2):            O O
                          O O
  Base Weight: 11
  RTP Factor: 0.7
  Usage: Compact corner/cluster filling
  Strategic Value: Medium - fills 2×2 areas

Total Intermediate Weight: 29 (out of ~183 baseline)
Baseline Appearance: ~16% of mid-game blocks
```

### Category 3: Advanced Blocks (Difficulty 4)
Complex tetromino pieces requiring high skill to place optimally.

```
T-Piece (+ 3 rotations):     0 1 0     1 0 0     1 1 1     0 0 1
                             1 1 1     1 1 0     0 1 0     0 1 1
                                       1 0 0               0 1 0
  Base Weight: 10 (per rotation)
  RTP Factor: 1.0
  Total Weight: 40 (4 rotations)
  Usage: Mid-to-late game strategic play
  Strategic Value: High - multiple line completion angles

L-Piece (+ 3 rotations):     1 0 0     1 1     0 0 1     0 1 0
                             1 1 1     1 0     1 1 1     0 1 0
                                       1 0               1 1 0
                                       1 0
  Base Weight: 9 (per rotation)
  RTP Factor: 1.1
  Total Weight: 36 (4 rotations)
  Usage: Complex gap filling
  Strategic Value: Very High - 4 placement orientations

J-Piece (+ 3 rotations):     0 0 1     1 0     1 1 1     1 1 0
                             1 1 1     1 0     1 0 0     0 1 0
                                       1 1               0 1 0
                                       1 0
  Base Weight: 9 (per rotation)
  RTP Factor: 1.1
  Total Weight: 36 (4 rotations)
  Usage: Complex gap filling
  Strategic Value: Very High - mirror of L-piece

S-Piece (+ vertical):        0 1 1     1 0
                             1 1 0     1 1
                                       0 1
  Base Weight: 8 (per variation)
  RTP Factor: 1.3 (HIGHEST - excellent for RTP recovery)
  Total Weight: 16 (2 variations)
  Usage: RTP boost blocks
  Strategic Value: High - tricky but rewarding placement

Z-Piece (+ vertical):        1 1 0     0 1
                             0 1 1     1 1
                                       1 0
  Base Weight: 8 (per variation)
  RTP Factor: 1.3 (HIGHEST - excellent for RTP recovery)
  Total Weight: 16 (2 variations)
  Usage: RTP boost blocks
  Strategic Value: High - tricky but rewarding placement

Total Advanced Weight: 144 (out of ~183 baseline)
Baseline Appearance: ~18% of blocks in pool
```

---

## Weight Calculation Algorithm

### Base Weight Selection
When the game generates block options, it calculates weighted probability:

```javascript
weight = BASE_WEIGHT × difficulty_multiplier × rtp_adjustment × performance_multiplier

Where:
- BASE_WEIGHT: Static value from BLOCK_WEIGHTS (see table above)
- difficulty_multiplier: Scales based on game progression (0.3x to 4.5x)
- rtp_adjustment: Based on current RTP vs target (90%)
- performance_multiplier: Based on recent game performance
```

### RTP Factor Explanation

**RTP Factor** determines how much a block's weight increases when RTP is below target:

```
IF (Current RTP < 90% Target):
  weight *= (1 + rtp_factor × negative_adjustment × 0.5)
  
IF (Current RTP > 90% Target):
  weight *= (1 + rtp_factor × positive_adjustment × 0.1)
```

**High RTP Factor Blocks** (S and Z pieces at 1.3):
- Heavily increased when RTP is struggling
- Better strategic placement options
- Result: Player has easier time completing lines → RTP recovers

**Low RTP Factor Blocks** (Single at 0.3):
- Barely increased when RTP is struggling
- Used to balance the game naturally
- Result: Game stays challenging even when RTP is down

---

## Difficulty Tier System

The game has 25 difficulty tiers (0-24) based on total lines cleared:

```
Tier = floor(linesCleared / 1)
```

Each tier applies a **multiplier** to block weights:

### Tier Multipliers by Difficulty

| Difficulty Band | Tier 0 | Tier 6 | Tier 12 | Tier 18 | Tier 24 |
|---|---|---|---|---|---|
| **Easy blocks** (D ≤ 1.5) | 1.0× | 0.64× | 0.40× | 0.24× | 0.40× |
| **Medium blocks** (D ≤ 3.5) | 1.0× | 0.60× | 0.40× | 0.40× | 0.40× |
| **Hard blocks** (D ≤ 4.5) | 1.0× | 1.15× | 1.50× | 2.20× | 3.50× |

**Pattern:**
- **Easy blocks:** Taper off as game progresses (0.3x to 1.0x)
- **Medium blocks:** Consistent, slight decrease (0.4x to 1.0x)
- **Hard blocks:** Ramp up dramatically (1.0x to 4.5x)

**Result:** Early game = mostly easy blocks. Late game = challenging complex pieces.

---

## Weight Distribution Visualization

### Early Game (0-5 lines cleared)
```
Single (88)      ████████████████████████████████████████████ 48%
Double (16)      ████████ 9%
Double V (16)    ████████ 9%
T-pieces (40)    ██████ 11%
L-pieces (36)    ██████ 10%
J-pieces (36)    ██████ 10%
S-pieces (16)    ████ 2%
Z-pieces (16)    ████ 2%
(Others)         █ (remainder ~3%)
```

### Mid Game (10-15 lines cleared)
```
Single (65)      ███████████████████████████ 35%
Double (12)      ████ 6%
Double V (12)    ████ 6%
T-pieces (115)   ████████████████ 25%
L-pieces (103)   ███████████████ 22%
J-pieces (103)   ███████████████ 22%
S-pieces (46)    ████ 10%
Z-pieces (46)    ████ 10%
(Others)         (other pieces diminish)
```

### Late Game (20+ lines cleared)
```
Single (26)      ██ 6%
Double (5)       █ 1%
Double V (5)     █ 1%
T-pieces (350)   ████████████████ 20%
L-pieces (314)   ███████████████ 18%
J-pieces (314)   ███████████████ 18%
S-pieces (140)   ████████ 20%
Z-pieces (140)   ████████ 20%
(Others)         ████ (other pieces ramp up)
```

---

## Total Baseline Weight

```
Single:           88
Double:           16
Double V:         16
I-piece:          9
I-piece V:        9
O-piece:          11
T-pieces (4):     40
L-pieces (4):     36
J-pieces (4):     36
S-pieces (2):     16
Z-pieces (2):     16
───────────────────
TOTAL:           293 baseline weight units
```

**Probability Calculation:**
```
Block Appearance % = (Block Weight / Total Weight) × 100%

Example at game start:
- Single: (88 / 293) × 100% = 30%
  (but displayed as ~48% because 5 blocks chosen simultaneously)
```

---

## Block Selection Process

### Step 1: Calculate Base Weights
For each block, calculate:
```
weight = base_weight × difficulty_weight
```

### Step 2: Apply RTP Adjustment
```
IF rtp_gap > 0 (current RTP below target):
  weight *= (1 + block.rtp_factor × rtp_gap × 0.5)
ELSE (current RTP above target):
  weight *= (1 + block.rtp_factor × rtp_gap × 0.1)
```

### Step 3: Apply Tier Multiplier
```
tier = floor(linesCleared / 1)
tier_multiplier = getDifficultyMultiplierForTier(tier, block.difficulty)
weight *= tier_multiplier
```

### Step 4: Apply Performance Bonus
```
IF recent_rtp > (target + 0.05):
  weight *= (1 + (difficulty - 1) × 0.05) // Increase hard blocks
ELSE IF recent_rtp < (target - 0.05):
  weight *= (1 - (difficulty - 1) × 0.03) // Decrease hard blocks
```

### Step 5: Random Selection
```
total_weight = sum of all adjusted weights
random_value = random(0, total_weight)
selected_block = block where cumulative_weight >= random_value
```

---

## RTP Factor Deep Dive

### Why S and Z Pieces Have Highest RTP Factor (1.3)

These pieces are **harder to place** but offer **excellent line completion potential** when placed correctly:

```
S-Piece:    0 1 1        Strategic advantage: 
            1 1 0        - Zigzag pattern fills gaps efficiently
                         - Can complete 2 lines simultaneously
                         - Better players clear more with S/Z
                         
Z-Piece:    1 1 0        Same advantages as S-piece but rotated
            0 1 1        
```

**Weight Effect:** When RTP drops, these blocks appear MORE OFTEN to help skilled players recover RTP.

### Why Single Block Has Lowest RTP Factor (0.3)

Single blocks are **too easy** - they let unskilled players survive longer without clearing lines:

```
Single:     O            Problem when RTP is low:
                         - Can place anywhere
                         - Doesn't guarantee line completion
                         - Extends gameplay without progress
                         
                         Solution:
                         - Keep weight constant (RTP factor 0.3)
                         - Don't increase when RTP drops
                         - Forces use of better strategic pieces
```

### I-Piece RTP Factor (1.2)

High RTP factor because:
- **4 cells in a row** = fills entire 7-wide grid when placed horizontally
- **Excellent for line completion** = directly increases payout
- **Difficult to place** = requires planning
- **Result:** High-skill players benefit greatly when I-pieces appear

---

## Game Progression Example

**Game Start: 0 lines cleared**
```
Tier: 0
RTP: Start with 90% target
Available blocks offered:
  - Single (88 weight) ← Very likely
  - Double (16 weight) ← Somewhat likely
  - I-piece (9 weight) ← Less likely
  - Complex pieces ← Rare
```

**After 5 lines cleared**
```
Tier: 5
RTP: ~85% (below target)
Tier multiplier: 0.7× for easy, 1.3× for hard
Adjusted weights:
  - Single (88 × 0.7) = 61.6 ← Reduced
  - Double (16 × 0.7) = 11.2 ← Reduced
  - I-piece (9 × 1.3 × 1.2) = 14.04 ← Boosted (RTP factor + tier)
  - T-pieces (40 × 1.3 × 1.0) = 52 ← Heavily boosted
  - S/Z pieces (16 × 1.3 × 1.3) = 27.04 ← Maximum boost
```

**After 15 lines cleared**
```
Tier: 15
RTP: ~90% (at target)
Tier multiplier: 1.5× for easy, 2.5× for hard
Available blocks offered:
  - Single (88 × 1.5) = 132 ← Still appears but less strategic
  - Complex pieces heavily weighted ← Now 50%+ of offers
  
Player should see: Complex L, J, T, S, Z pieces
```

**After 25 lines cleared (Late game)**
```
Tier: 24 (maximum)
RTP: ~92% (slightly above target)
Tier multiplier: 0.4× for easy, 3.5× for hard
Adjusted weights:
  - Single (88 × 0.4) = 35.2 ← Rare
  - T-pieces (40 × 3.5) = 140 ← Very common
  - L-pieces (36 × 3.5) = 126 ← Very common
  - S/Z pieces (16 × 3.5 × 1.3) = 72.8 ← Extremely common
  
Result: Game is now HARD - complex pieces dominate
```

---

## Weight Adjustment Parameters

### Dynamic Adjustment Settings

```javascript
DIFFICULTY_WEIGHT_SETTINGS = {
    bonusPerPoint: 1.2,      // Difficulty multiplier per point
    multiplierRange: 0.5     // Range of multiplier (0.5 = 0.5x to 1.5x)
}

RTP_ADJUSTMENT = {
    positive_gap_factor: 0.5,   // When RTP < target, multiply by this
    negative_gap_factor: 0.1    // When RTP > target, use smaller multiplier
}

PERFORMANCE_ADJUSTMENT = {
    hard_block_boost: 0.05,     // Boost hard blocks if player performing well
    hard_block_reduce: -0.03    // Reduce hard blocks if player struggling
}
```

---

## Summary: Key Weight Insights

1. **Single Block (88 weight)** - Dominates early game (~48% appearance)
2. **Complex Pieces (L, J, T, S, Z)** - Scale from 5% to 50% as game progresses
3. **RTP Factors** - S & Z highest (1.3), Single lowest (0.3)
4. **Tier Progression** - Easy blocks decay, hard blocks multiply
5. **Self-Balancing** - Weights adjust to maintain 90% RTP target

---

## Files Reference

- **Block Shapes:** `BLOCK_SHAPES` object in [script.js](script.js#L80)
- **Block Weights:** `BLOCK_WEIGHTS` object in [script.js](script.js#L128)
- **Block Difficulty:** `BLOCK_DIFFICULTY` object in [script.js](script.js#L61)
- **Weight Calculation:** `selectWeightedBlock()` function in [script.js](script.js#L392)
- **Tier System:** `getDifficultyTier()` & `getDifficultyMultiplierForTier()` in [script.js](script.js#L380)

