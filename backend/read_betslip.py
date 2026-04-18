import sys
with open(r"c:\Smart_Proto_Investor_Plan\frontend\app\components\BetSlip.tsx", "r", encoding="utf-8", errors="ignore") as f:
    text = f.read()

with open(r"c:\Smart_Proto_Investor_Plan\frontend\app\components\BetSlip_copied.md", "w", encoding="utf-8") as f:
    f.write(text)
