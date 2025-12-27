# Mayham Golf Scoring Guide

**For Tournament Organizers and Players**

## Introduction

Welcome to the enhanced scoring system for Mayham Golf tournaments! This guide explains how to use the new features including Stableford scoring and flexible match configurations.

---

## Table of Contents

1. [Understanding Scoring Methods](#understanding-scoring-methods)
2. [Setting Up Tournaments](#setting-up-tournaments)
3. [Configuring Matches](#configuring-matches)
4. [Entering Scores](#entering-scores)
5. [Viewing Results](#viewing-results)
6. [Common Scenarios](#common-scenarios)

---

## Understanding Scoring Methods

### Gross Scoring (Traditional)

**What is it?**
Traditional stroke play where you count every stroke. Lower score wins.

**When to use:**
- Traditional stroke play tournaments
- When you want straightforward "lowest score wins" format
- Competitions where exact stroke totals matter

**Example:**
- Par 4 hole
- Player shoots 5 (one over par)
- Score recorded: 5 strokes
- No points conversion

**Best for:**
- Competitive players
- Official handicap tracking
- Medal play events

---

### Stableford Scoring (Points-Based)

**What is it?**
A points-based system that rewards good holes and limits damage from bad holes. You earn points based on your score relative to par.

**When to use:**
- Social tournaments where fun matters more than competition
- Events with mixed skill levels
- When you want to encourage aggressive play
- Speed up play (pick up after zero points)

**Points Breakdown:**

| Your Score | Points | Example (Par 4) |
|------------|--------|-----------------|
| Albatross or better (-3) | 5 points | Score 1 on Par 4 |
| Eagle (-2) | 4 points | Score 2 on Par 4 |
| Birdie (-1) | 3 points | Score 3 on Par 4 |
| Par (0) | 2 points | Score 4 on Par 4 |
| Bogey (+1) | 1 point | Score 5 on Par 4 |
| Double bogey or worse (+2) | 0 points | Score 6+ on Par 4 |

**Key Benefits:**
- ✅ Bad holes don't ruin your whole round (max damage = 0 points)
- ✅ Rewards aggressive play (birdies worth more than pars)
- ✅ Faster play (can pick up when you reach 0 points)
- ✅ More forgiving for beginners

**Example Round:**
```
Hole 1 (Par 4): Score 4 (Par) = 2 points
Hole 2 (Par 3): Score 2 (Birdie) = 3 points
Hole 3 (Par 5): Score 8 (Triple bogey) = 0 points
Hole 4 (Par 4): Score 3 (Birdie) = 3 points

Total after 4 holes: 8 points (Bad hole 3 didn't kill your score!)
```

---

## Setting Up Tournaments

### Step 1: Create Your Tournament

1. Navigate to **Tournament Setup**
2. Click **Create New Tournament**
3. Fill in basic details:
   - Tournament name
   - Description
   - Dates
   - Select your group

### Step 2: Choose Scoring Method

**Important:** This choice cannot be changed after creation!

**Select "Gross Scoring" if:**
- Running a traditional stroke play event
- Need official USGA handicap tracking
- Players prefer straightforward scoring

**Select "Stableford Scoring" if:**
- Want faster, more fun play
- Mixed skill levels participating
- Social event focused on enjoyment
- Want to limit impact of bad holes

### Step 3: Create Teams

Add two or more teams (e.g., "Team USA" vs "Team Europe")
- Assign team colors for easy identification
- Add team members from your group

---

## Configuring Matches

### Understanding Match Hole Ranges

You can now split an 18-hole round into multiple matches!

**Why use hole ranges?**
- Create variety within a single round
- Award points for different segments
- Allow format changes (e.g., scramble on front 9, match play on back 9)

### Common Configurations

#### Full 18-Hole Match (Traditional)
```
Match 1: Holes 1-18
Format: Singles Match Play
Points Available: 1.0
```
**Setup:** Leave hole range empty or select "Full 18 holes"

#### Three 6-Hole Matches
```
Match 1: Holes 1-6 (Front third)
Match 2: Holes 7-12 (Middle third)
Match 3: Holes 13-18 (Back third)
Format: Best Ball for each
Points Available: 1.0 each (3 total points)
```
**Setup:** Specify start and end holes for each match

#### Two 9-Hole Matches
```
Match 1: Holes 1-9 (Front nine)
Match 2: Holes 10-18 (Back nine)
Format: Scramble on front, Match Play on back
Points Available: 1.0 each (2 total points)
```
**Setup:** Useful for changing formats mid-round

### Match Formats and Score Entry

Different formats require different score entry methods:

#### Individual Score Formats
**Each player enters their own score**

- ✅ **Singles Match Play** - Head-to-head, 1v1
- ✅ **Best Ball** - Best score per team counts
- ✅ **High-Low** - Sum of team's best and worst scores
- ✅ **Shamble** - Team tees off together, then individual

**What players see:**
- Input field for each player
- "Player 1: __  Player 2: __  Player 3: __  Player 4: __"

#### Team Score Formats
**One combined score per team**

- ✅ **Scramble** - Team plays one ball together
- ✅ **Alternate Shot** - Players alternate hitting same ball

**What players see:**
- Input field for each team
- "Team Alpha: __  Team Beta: __"

---

## Entering Scores

### Basic Score Entry

1. Navigate to **Score Entry**
2. Select your tournament
3. Select your pairing (group you're playing with)
4. Select which match (if multiple matches configured)

### Score Entry Interface

#### For Individual Formats:

**You'll see:**
```
Hole 1 - Par 4

Player 1 (Team Alpha): [ 4 ]
Player 2 (Team Alpha): [ 5 ]
Player 3 (Team Beta):  [ 4 ]
Player 4 (Team Beta):  [ 3 ]

[Submit Scores]
```

**For Stableford tournaments, you'll also see:**
```
Hole 1 - Par 4

Player 1 (Team Alpha): [ 4 ] = 2 points (Par)
Player 2 (Team Alpha): [ 5 ] = 1 point (Bogey)
Player 3 (Team Beta):  [ 4 ] = 2 points (Par)
Player 4 (Team Beta):  [ 3 ] = 3 points (Birdie!)

Team Alpha: 3 points | Team Beta: 5 points
[Submit Scores]
```

#### For Team Formats:

**You'll see:**
```
Hole 1 - Par 4

Team Alpha: [ 4 ]
Team Beta:  [ 5 ]

[Submit Scores]
```

### Hole Navigation

**For matches with specific hole ranges:**
- Only relevant holes appear
- Example: Match covering holes 7-12 only shows holes 7, 8, 9, 10, 11, 12
- Navigate with "Previous Hole" and "Next Hole" buttons

---

## Viewing Results

### Live Leaderboard

Watch the tournament unfold in real-time:

**For Gross Scoring:**
- Team standings show total strokes
- Lower is better
- Individual player totals visible

**For Stableford Scoring:**
- Team standings show total points
- Higher is better
- Points breakdown per hole
- Running total updates live

### Match Status

Each match shows:
- Current score (strokes or points)
- Holes completed
- Holes remaining
- Match winner (when complete)

---

## Common Scenarios

### Scenario 1: Traditional Ryder Cup Format

**Goal:** 18-hole match play, one-on-one

**Setup:**
- Scoring Method: Gross
- Match Format: Singles Match Play
- Hole Range: Leave blank (full 18)
- Score Entry: Individual

**Play:**
- Each player enters their own score
- System determines hole winner
- Match winner decided by holes won

---

### Scenario 2: Fun Social Tournament

**Goal:** Stableford scoring to keep it fun

**Setup:**
- Scoring Method: Stableford
- Match Format: Best Ball
- Hole Range: Full 18 holes
- Score Entry: Individual

**Play:**
- Players enter individual scores
- System calculates Stableford points
- Team with most points wins
- Players can pick up when they reach 0 points on a hole

---

### Scenario 3: Mixed Format Round

**Goal:** Different formats for different segments

**Setup:**
- Scoring Method: Gross
- Match 1: Holes 1-6, Scramble format (Team entry)
- Match 2: Holes 7-12, Best Ball format (Individual entry)
- Match 3: Holes 13-18, Match Play format (Individual entry)

**Play:**
- Holes 1-6: Submit one score per team
- Holes 7-12: Each player enters their score, best counts
- Holes 13-18: Each player enters score, direct comparison
- Each match awards 1 point (3 total points available)

---

### Scenario 4: Quick 9-Hole Event

**Goal:** Two separate 9-hole matches

**Setup:**
- Scoring Method: Stableford
- Match 1: Holes 1-9, Shamble
- Match 2: Holes 10-18, Scramble

**Play:**
- Front 9: Individual scores, team entry on drive
- Back 9: Pure scramble, team scores
- Each match worth 1 point

---

## Tips for Success

### For Tournament Organizers

1. **Choose Scoring Method Carefully**
   - Can't change after tournament created
   - Stableford = More fun, faster play
   - Gross = Traditional competition

2. **Plan Match Formats**
   - Mix it up! Different formats add variety
   - Consider player skill levels
   - Scramble formats good for beginners

3. **Communicate Clearly**
   - Tell players which scoring method you're using
   - Explain match format before round
   - Remind about team vs individual score entry

### For Players

1. **Check Match Format**
   - Individual or team entry?
   - Which holes does this match cover?
   - What scoring method?

2. **Stableford Strategy**
   - Play aggressively for birdies (3 points!)
   - Pick up when you reach 0 points
   - One bad hole won't ruin your round

3. **Score Entry**
   - Enter scores hole-by-hole for live updates
   - Double-check before submitting
   - Confirm all players in group submit

---

## Troubleshooting

**Q: Why can't I enter a score for this hole?**
A: Check if this hole is part of your current match's range. If your match covers holes 1-6, you can't enter scores for hole 7.

**Q: The system says "team score required" but I see individual players?**
A: This match uses a team format (Scramble or Alternate Shot). Enter one combined score per team, not individual scores.

**Q: How do I change from Gross to Stableford scoring?**
A: You can't change after tournament creation. You'll need to create a new tournament with the desired scoring method.

**Q: Do Stableford points get calculated automatically?**
A: Yes! Just enter the strokes. The system calculates points based on par and handicap.

**Q: Can I edit a score after submitting?**
A: Currently no - please verify scores before submitting. Contact tournament admin if correction needed.

---

## Summary

**Key Takeaways:**

✅ Choose between **Gross** (traditional strokes) or **Stableford** (points) scoring  
✅ Configure matches for **specific hole ranges** (6, 9, or 18 holes)  
✅ Some formats need **individual scores**, others need **team scores**  
✅ Stableford makes golf **more fun** and **faster**  
✅ Match results update **live** as scores are entered  

**Have fun and play well!** ⛳

---

## Additional Resources

- **API Documentation:** See `API_SCORING.md` for technical details
- **Database Schema:** See `ProjectStructure.md` for data structure
- **Testing Guide:** See `TESTING.md` for validation procedures

**Questions?** Contact your tournament administrator or system admin.
