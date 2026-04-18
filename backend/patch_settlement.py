import os

filepath = r"c:\Smart_Proto_Investor_Plan\backend\app\services\settlement.py"
with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

target = """            # Only update if status changed from PENDING
            if overall_status != "PENDING":
                await update_slip_status(
                    slip_id=slip_id,
                    status=overall_status,
                    results=grade_result["results"],
                    reason=f"Auto-settled. Final grade: {overall_status}"
                )
                stats["settled"] += 1"""

replacement = """            # Only update if status changed from PENDING
            if overall_status != "PENDING":
                await update_slip_status(
                    slip_id=slip_id,
                    status=overall_status,
                    results=grade_result["results"],
                    reason=f"Auto-settled. Final grade: {overall_status}"
                )
                
                # Update User Stats
                try:
                    from app.models.user_db import update_user_prediction_stats
                    await update_user_prediction_stats(
                        user_id=slip.get("user_id"),
                        new_slip_status=overall_status,
                        total_odds=slip.get("total_odds", 1.0)
                    )
                except Exception as stats_e:
                    logger.error(f"Failed to update user stats for slip {slip_id}: {stats_e}")
                    
                stats["settled"] += 1"""

if target in text:
    new_text = text.replace(target, replacement)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(new_text)
    print("PATCH_SUCCESS")
else:
    print("TARGET_NOT_FOUND")
