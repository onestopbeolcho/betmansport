import re
with open(r"c:\Smart_Proto_Investor_Plan\frontend\app\components\Navbar.tsx", "r", encoding="utf-8", errors="ignore") as f:
    text = f.read()

matches = re.finditer(r"href\s*:\s*['\"]([^'\"]+)['\"]", text)
for m in matches:
    print(m.group(1))
