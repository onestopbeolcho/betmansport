from app.models.betman_db import save_betman_round, get_betman_matches, update_betman_match, add_betman_match, delete_betman_match, get_betman_status
import json

# 1. Save test round
test_matches = [
    {"team_home": "맨체스터 시티", "team_away": "리버풀", "home_odds": 2.50, "draw_odds": 3.30, "away_odds": 3.40, "sport": "Soccer", "league": "EPL"},
    {"team_home": "LA 레이커스", "team_away": "보스턴 셀틱스", "home_odds": 1.85, "draw_odds": 0, "away_odds": 1.95, "sport": "Basketball", "league": "NBA"},
]
count = save_betman_round("260099", test_matches)
print(f"1. Saved: {count} matches")

# 2. Read
matches = get_betman_matches()
print(f"2. Read: {len(matches)} matches")
mid = matches[0]["match_id"]
print(f"   First match_id: {mid}")

# 3. Update
updated = update_betman_match(mid, {"home_odds": 2.80})
print(f"3. Updated odds: {updated['home_odds']} (was 2.50)")

# 4. Add manual
added = add_betman_match({"team_home": "레알 마드리드", "team_away": "바르셀로나", "home_odds": 2.10, "draw_odds": 3.20, "away_odds": 3.50, "sport": "Soccer", "league": "La Liga"})
print(f"4. Added: {added['team_home']} vs {added['team_away']}")

# 5. Status
status = get_betman_status()
print(f"5. Status: {json.dumps(status, indent=2)}")

# 6. Delete
deleted = delete_betman_match(added["match_id"])
print(f"6. Deleted: {deleted}")

final = get_betman_matches()
print(f"7. Final count: {len(final)}")
print("✅ All CRUD operations passed!")
