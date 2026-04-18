import re

filepath = r"c:\Smart_Proto_Investor_Plan\frontend\app\components\BetSlip.tsx"
with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
    text = f.read()

idx = text.find('else {')
if idx != -1:
    print(text[idx-50:idx+200])
else:
    print("Could not find 'else {'")
