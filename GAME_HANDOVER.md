# Bubble Blast – Gameplay & RTP Control Handover

This document captures the current production logic so another developer can rebuild or extend the game without diving through the entire codebase.

---

## 1. Core Loop

1. Player pays `$1.00` to start a game.  
2. Board = `8 × 8` grid.  
3. Three block offers are shown at a time.  
4. Player (or autoplay AI) places one offer, block replaced immediately.  
5. When rows or columns are filled they clear and pay; play continues until no placements are possible.  
6. Each cleared line pays `LINE_PAYOUT = $0.40`. 
7. Final balance is the total payout earned during the run.

---

## 2. Block Catalogue (current set)

| Category | Key | Shape | Difficulty | Base Weight | Notes |
| --- | --- | --- | --- | --- | --- |
| Single | `single` | `[[1]]` | 1.0 | 18 | High frequency starter |
| Double | `double` | `[[1,1]]` | 1.5 | 16 | Fits gaps easily |
| Lines | `line2`, `line2_vertical` | 2 cells | 2.0 | 12 | Horizontal/vertical |
| Lines | `line3`, `line3_vertical` | 3 cells | 2.5 | 10 |  |
| Lines | `line4`, `line4_vertical` | 4 cells | 3.5 | 8 |  |
| Lines | `line5`, `line5_vertical` | 5 cells | 5.0 | 5 | Harder, higher RTP factor |
| Squares | `square2x2` | 2×2 | 3.0 | 12 | Stable filler |
| Squares | `square3x3` | 3×3 | 7.0 | 4 | Difficult to place |
| Rectangles | `rect2x3`, `rect3x2` | 2×3 / 3×2 | 4.0 | 7 |  |
| Classic | `I_piece`, `I_piece_vertical` | 1×4 | 3.5 | 9 | |
| Classic | `O_piece` | 2×2 | 3.0 | 11 | |
| Classic | `T_piece` (+ rotations) | T shape | 4.0 | 10 | All four orientations |
| Classic | `L_piece` (+ rotations) | L shape | 4.5 | 9 | |
| Classic | `J_piece` (+ rotations) | Reverse L | 4.5 | 9 | |
| Classic | `S_piece` (+ rotations) | S-shape | 5.5 | 8 | |
| Classic | `Z_piece` (+ rotations) | Z-shape | 5.5 | 8 | |
| Long | `long6`, `long6_vertical` | 6 cells | 8.5 | 4 | Rare, high RTP factor |
| Asymmetric | `snake_long`, `snake_long_vertical` | snake | 6.5 | 7 | |
| Asymmetric | `hook`, `hook_rotated` | hook | 6.0 | 8 | |
| Cross | `cross` | `[[0,1,0],[1,1,1],[0,1,0]]` | 5.0 | 9 | |
| Plus | `plus_big` | large + | 9.0 | 3 | |
| Corner | `corner2x2`(all rotations) | L 2×2 | 2.5 | 14 | |
| Diagonal | `diagonal3`, `diagonal3_reverse` | diagonal | 6.0 | 6 | |
| Stair | `stair3`, `stair3_reverse` | stairs | 5.5 | 7 | |
| Hollow | `hollow_square`, `hollow_cross` | rings | 8.0 / 7.5 | 3 / 4 | |
| Cluster | `cluster4`, `cluster5_cross`, `cluster5_plus` | compact clusters | ~3–5 | 10 / 8 / 9 | |

**Key fields:**
- **Difficulty**: 1 (very easy) → 10 (nearly impossible). Used by tier scaling.
- **Base Weight**: Starting probability weight before adjustments.
- **`rtp_factor`** (see code) amplifies weight when RTP is below target.

---

## 3. Block Selection Algorithm

```pseudo
function selectWeightedBlock():
    tier = getDifficultyTier(linesCleared)     // 0..24 based on total lines cleared
    perfMultiplier = calculatePerformanceMultiplier()  // small nudges from recent games

    for each blockType:
        weight = BLOCK_WEIGHTS[blockType].base

        // RTP steering
        rtpAdjustment = TARGET_RTP - currentRTPEstimate
        if rtpAdjustment > 0:
            weight *= (1 + rtp_factor * rtpAdjustment * 0.5)
        else:
            weight *= (1 + rtp_factor * rtpAdjustment * 0.1)

        // Tier scaling based on difficulty
        tierMultiplier = getDifficultyMultiplierForTier(tier, difficulty)
        weight *= tierMultiplier

        // Performance multiplier (small effect)
        weight *= perfAdjustment(perfMultiplier, difficulty)

    return randomChoice(weighted by weight)
```

### Tier progression
- `getDifficultyTier(linesCleared)` = `min(floor(linesCleared / 1), 24)`  
  (Each cleared line advances the tier until the cap at 24.)

### Tier multiplier profile

| Difficulty band (D) | Multiplier |
| --- | --- |
| D ≤ 1.5 | `max(0.3, 1 - 0.6 * progress)` |
| D ≤ 2.5 | `max(0.4, 1 - 0.5 * progress)` |
| D ≤ 3.5 | `max(0.5, 1 - 0.4 * progress)` |
| D ≤ 4.5 | `max(0.6, 1 - 0.3 * progress)` |
| D ≤ 5.5 | `max(0.7, 1 - 0.2 * progress)` |
| D ≤ 6.5 | `max(0.8, 1 - 0.1 * progress)` |
| D ≤ 7.5 | `1 + 1.5 * progress` (→ 2.5×) |
| D ≤ 8.5 | `1 + 2.5 * progress` (→ 3.5×) |
| D > 8.5 | `1 + 3.5 * progress` (→ 4.5×) |

`progress = tier / 24`. Easy blocks taper off gradually; hard blocks become more likely in later tiers.

### Performance multiplier

Tracks the average RTP of the last 10 games.  
- If recent RTP > target by >5%, increase weight of hard blocks (`+0.05 × diff × (difficulty-1)`).  
- If below by >5%, reduce weights slightly (`-0.03 × diff × (difficulty-1)`).

---

## 4. RTP Simulation

- Each simulated game starts with `$1.00`, immediately deducts `$1.00` to play.  
- Autoplay AI uses the same placement heuristics as manual play.  
- After 10,000 games, report:
  - Total coin-in, total coin-out, calculated RTP.
  - Average lines cleared.
  - Sample rows every 100 games for auditing.

---

## 5. Key Constants (see `GAME_CONFIG`)

| Name | Value | Notes |
| --- | --- | --- |
| `GRID_SIZE` | 8 | Board dimensions |
| `LINE_PAYOUT` | `$0.40` | Flat payout per cleared line |
| `GAME_COST` | `$1.00` | Entry fee |
| `TARGET_RTP` | `0.97` | Used for weight steering |
| `MAX_MULTIPLIER` | 10 | Currently unused (multipliers disabled) |

---

## 6. Suggestions for Tuning

To move RTP upward (toward 90–100%):
1. Reduce tier multipliers for high-difficulty bands (keeps hard pieces rarer).  
2. Increase base weights for lines/squares.  
3. Slightly lower `LINE_PAYOUT` only if structural changes are insufficient.

To move RTP downward:
1. Increase difficulty tier multipliers faster.  
2. Reduce base weights of easy blocks.  
3. Introduce multipliers again (if desired) but ensure they reset correctly.

---

Everything above mirrors the live logic in `script.js` at commit time. The developer implementing the game can rebuild the selection and RTP systems directly from these tables and formulas.

