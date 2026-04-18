import os
import json

filepath = r"c:\Smart_Proto_Investor_Plan\backend\app\models\user_db.py"
with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

# Add the new function before `# --- Payment Helpers ---`
target = "# --- Payment Helpers ---"
new_func = """
async def update_user_prediction_stats(user_id: str, new_slip_status: str, total_odds: float):
    User = await get_user_by_id(user_id)
    if not User:
        return
    
    stats = User.get("stats", {"won": 0, "lost": 0, "push": 0, "partial": 0, "total_roi": 0.0, "prediction_count": 0})
    stats["prediction_count"] += 1
    
    if new_slip_status == "WON":
        stats["won"] += 1
        stats["total_roi"] += (total_odds - 1) * 100
    elif new_slip_status == "LOST":
        stats["lost"] += 1
        stats["total_roi"] -= 100
    elif new_slip_status == "PUSH":
        stats["push"] += 1
    elif new_slip_status == "PARTIAL":
        stats["partial"] += 1
        
    total_decided = stats["won"] + stats["lost"] + stats["partial"]
    stats["hit_rate"] = round(stats["won"] / total_decided * 100, 2) if total_decided > 0 else 0.0
    
    await update_user(user_id, {"stats": stats})

# --- Payment Helpers ---"""

if target in text:
    new_text = text.replace(target, new_func)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(new_text)
    print("PATCH_SUCCESS")
else:
    print("TARGET_NOT_FOUND")
