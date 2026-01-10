# Match Players Migration Guide

## Quick Start

This guide explains how to apply the match_players table changes to your database.

## For New Installations

**No action needed!** The `match_players` table is already included in the main schema file (`mayhamapi/db/golf_db_schema.sql`) and will be created automatically when you first start the application.

## For Existing Databases

### Option 1: Restart the Backend (Recommended)

The main schema file has been updated to include the `match_players` table with `CREATE TABLE IF NOT EXISTS`, so simply restarting the backend will create the table automatically:

```bash
cd /root/may-ham-scoreboard/mayhamapi

# Stop the backend if it's running
# Then start it again
make run
# or
make dev
```

The backend will automatically:
1. Create the `match_players` table if it doesn't exist
2. Create the necessary indexes
3. The table will be empty initially

### Option 2: Manual Migration

If you want to manually run the migration and backfill existing data:

```bash
# Navigate to the mayhamapi directory
cd /root/may-ham-scoreboard/mayhamapi

# Run the migration SQL file
psql -U postgres -d mayham_golf -f db/migrations/002_add_match_players.sql
```

This migration will:
1. Create the `match_players` table
2. Create indexes for performance
3. **Backfill all existing matches** with players from their pairings

### Verify the Migration

After restarting or running the migration, verify it worked:

```bash
# Check that the table exists
psql -U postgres -d mayham_golf -c "\d match_players"

# Check if data was backfilled (for manual migration only)
psql -U postgres -d mayham_golf -c "SELECT COUNT(*) FROM match_players;"

# View sample match players
psql -U postgres -d mayham_golf -c "
  SELECT mp.id, mp.match_id, mp.user_id, mp.team_id, mp.player_order, u.name
  FROM match_players mp
  JOIN users u ON mp.user_id = u.id
  LIMIT 5;
"
```

## Frontend Updates

After the database is updated, rebuild the frontend to use the new player display:

```bash
cd /root/may-ham-scoreboard/mayhamapi/frontend
npm run build
```

The built files will be placed in `mayhamapi/static/` and served by the Go backend.

## Expected Behavior After Migration

### Match Display
- **Before:** Matches showed only team names (e.g., "Team Alpha vs Team Beta")
- **After:** Matches show team names AND player names (e.g., "Team Alpha: John & Jane vs Team Beta: Bob & Alice")

### API Responses
All match objects returned by the API will now include a `players` array:

```json
{
  "id": "match-123",
  "team1": {"name": "Team Alpha"},
  "team2": {"name": "Team Beta"},
  "players": [
    {
      "id": "player-1",
      "match_id": "match-123",
      "user_id": "user-1",
      "team_id": "team1-id",
      "player_order": 1,
      "user": {
        "id": "user-1",
        "name": "John Doe",
        "email": "john@example.com"
      }
    }
    // ... more players
  ]
}
```

### Score Interface
When viewing match results in the Score Interface:
- Each match card will show player names below the team name
- For 1v1 matches: One player name per team
- For 2v2 matches: Both player names per team (joined with " & ")

### Leaderboard
Live matches on the leaderboard will also display player names.

## Rollback (if needed)

If you need to remove the match_players table:

```bash
# Drop the table
psql -U postgres -d mayham_golf -c "DROP TABLE IF EXISTS match_players CASCADE;"

# Drop the indexes
psql -U postgres -d mayham_golf -c "
  DROP INDEX IF EXISTS idx_match_players_match;
  DROP INDEX IF EXISTS idx_match_players_user;
"
```

⚠️ **Warning:** This will delete all match player assignments. Only do this if you're testing or need to revert.

## Troubleshooting

### Issue: "relation 'match_players' does not exist"

**Solution:** Run Option 1 or Option 2 from above.

### Issue: Match players not showing in the UI

**Possible causes:**
1. **Frontend not rebuilt** - Run `cd mayhamapi/frontend && npm run build`
2. **Backend not restarted** - Restart the backend to load new code
3. **Existing matches created before migration** - New matches will have players; old matches won't unless you ran the backfill migration

**Solution for old matches:** Run the manual migration (Option 2) which includes backfill logic.

### Issue: "column 'position' does not exist"

**Solution:** The field was renamed from `position` to `player_order`. Clear your browser cache and ensure you've pulled the latest frontend code.

## Next Steps

After the migration is complete:

1. ✅ Verify player names appear in the Score Interface
2. ✅ Check that the Leaderboard shows player names
3. ✅ Create a new match and confirm players are automatically assigned
4. ✅ Test both 1v1 and 2v2 match formats to ensure proper display

## Support

If you encounter issues:
1. Check the backend logs for errors
2. Verify the database schema with `\d match_players`
3. Check the frontend console for JavaScript errors
4. Review the main documentation: `MATCH_PLAYERS_REFACTORING.md`
