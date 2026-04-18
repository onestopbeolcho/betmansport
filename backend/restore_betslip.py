import json
import os

with open(r"c:\Smart_Proto_Investor_Plan\safe_read.json", "r", encoding="utf-8") as f:
    orig = json.load(f)

with open(r"c:\Smart_Proto_Investor_Plan\frontend\app\components\BetSlip.tsx", "w", encoding="utf-8") as f:
    f.write(orig)
    
print("Restored!")
