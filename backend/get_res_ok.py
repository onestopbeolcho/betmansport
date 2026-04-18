import os

filepath = r"c:\Smart_Proto_Investor_Plan\frontend\app\components\BetSlip.tsx"
with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
    text = f.read()

idx = text.find("res.ok")
if idx != -1:
    with open(r"c:\Smart_Proto_Investor_Plan\backend\res_ok_snippet.txt", "w", encoding="utf-8") as out:
        out.write(text[idx-50:idx+250])
