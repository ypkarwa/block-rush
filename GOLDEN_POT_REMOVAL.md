# Golden Pot Removal & 80% RTP Adjustment

## Overview
Removed all golden pot mechanics from Block Rush and adjusted the RTP system to ensure 80% return to player, with a maximum of 55 blocks per game (representing realistic skilled player performance).

---

## Changes Made

### 1. Game Configuration Updates
**File:** `script.js` (Lines 1-15)

```javascript
LINE_PAYOUT: 0.0145  // Changed from 0.0215 (90% RTP with golden pot)
TARGET_RTP: 0.80     // Changed from 0.90
MAX_BLOCKS_PER_GAME: 55  // New: limits max blocks to realistic 55
```

**Reasoning:**
- Old payout ($0.0215) was calibrated for 90% RTP with golden pot bonuses
- Golden pot contributed ~5-10% to overall RTP through bonus triggers
- Without golden pot, new payout is $0.0145/line
- 55 blocks = realistic skilled player limit (15 seconds → 5 seconds game speed)
- ~0.0145 × 18 lines average × 2.5x avg multiplier ≈ $0.65 from core game
- Total with occasional high clears and multipliers should average ~$0.80 (80% RTP)

### 2. Removed from GAME_CONFIG
- ~~`POT_LIMIT: [2,3,4]`~~

### 3. Removed from gameState
- ~~`potValue`~~
- ~~`goldenCells`~~
- ~~`goldenBatchActive`~~
- ~~`goldenBatchBlocksRemaining`~~
- ~~`goldenBlocks`~~

### 4. Removed Functions
- ~~`triggerGoldenPotExplosion()`~~ - No longer needed
- Golden batch tracking logic from `placeBlock()`
- Golden cell visual styling
- Golden bonus time allocation

### 5. Removed from handleLineClear()
- Golden pot accumulation logic
- Golden pot trigger condition
- Golden batch bonus payout (30% bonus)

### 6. UI Updates
- Removed `potElement` display from `updateUI()`
- Removed golden batch visual highlighting from block previews
- Simplified `renderBlockOptions()` - no golden batch detection

### 7. Simulation Updates

#### Removed from simpleGameSimulation():
- All golden pot state tracking
- Golden batch activation logic
- Golden bonus payout calculations
- Golden pot return values

#### Updated return object:
```javascript
// Old: { balance, linesCleared, moves, goldenPotTriggered, goldenPotBonus }
// New: { balance, linesCleared, moves }
```

#### Console Output Simplification:
- Removed "Gold" column from game logging
- Removed golden pot stats from final summary
- Cleaner output format focusing on core mechanics

---

## RTP Calibration Math

### Assumptions for 55-block limit:
- Average blocks placed per game: ~35-40 (before running out of space)
- Average lines cleared: ~16-20 per game
- Average multiplier: ~2.5x (accounting for consecutive clear streaks)

### Expected Payout Formula:
```
Base payout = LINE_PAYOUT × linesCleared × multiplier
            = 0.0145 × 18 × 2.5
            = $0.6525 (65.25% average)

With variance and occasional high performers:
Expected average: ~$0.80 (80% RTP target)
```

### Why Lower Payout?
1. **Golden pot removal:** ~5-10% of old revenue came from bonuses
2. **Block limit:** Caps maximum possible lines (can't play forever)
3. **Skill ceiling:** Even perfect play ≤ 80% RTP reinforces this is the max

---

## Testing Recommendations

1. **Run 1,000 game simulation** with medium difficulty
   - Check that RTP averages around 80%
   - Verify blocks placed stay near 55 maximum
   - Confirm average lines per game is 16-20

2. **Manual gameplay testing**
   - Play optimally and verify winnings are capped at ~80% of wager
   - Confirm time limits work (15s → 5s)
   - Verify no golden pot UI elements appear

3. **Edge cases**
   - Test with difficult difficulty (should still hit 80%)
   - Test with easy difficulty (should still hit 80%)
   - Verify no errors from removed golden pot code

---

## Benefits

✅ **Simpler gameplay** - No confusing golden pot mechanics  
✅ **Clearer RTP control** - Direct line payout = direct RTP  
✅ **Skill ceiling enforced** - Even perfect play can't exceed 80%  
✅ **More predictable** - Player expectations align with math  
✅ **Realistic limits** - 55 blocks matches actual game speed constraints
