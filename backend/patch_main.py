import os

filepath = r"c:\Smart_Proto_Investor_Plan\backend\app\main.py"
with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

target1 = "from app.api.endpoints import admin, odds, auth, payments, portfolio, market, scheduler, analysis, community, prediction, tax, combinator, ai_predictions, notifications"
rep1 = "from app.api.endpoints import admin, odds, auth, payments, portfolio, market, scheduler, analysis, community, prediction, tax, combinator, ai_predictions, notifications, league"

target2 = "app.include_router(notifications.router, prefix=\"/api/notifications\", tags=[\"notifications\"])"
rep2 = """app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])
app.include_router(league.router, prefix="/api/league", tags=["league"])"""

if target1 in text and target2 in text:
    new_text = text.replace(target1, rep1).replace(target2, rep2)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(new_text)
    print("PATCH_SUCCESS")
else:
    print("TARGET_NOT_FOUND")
