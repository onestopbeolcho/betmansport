import re
filepath = r"c:\Smart_Proto_Investor_Plan\frontend\app\page.tsx"

with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
    text = f.read()

target = 'href="/analysis"'
replacement = 'href="/league" className="text-indigo-400 font-bold hover:underline">Prediction League Leaderboard</a> | <a href="/analysis"'

if target in text:
    new_text = text.replace(target, replacement)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(new_text)
    print("PATCH_SUCCESS")
else:
    print("TARGET_NOT_FOUND")
