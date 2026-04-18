import re
with open(r"c:\Smart_Proto_Investor_Plan\frontend\app\components\Navbar.tsx", "r", encoding="utf-8", errors="ignore") as f:
    text = f.read()

idx = text.find("/market")
if idx != -1:
    print(text[max(0, idx-500):idx+500])
else:
    print("NOT FOUND")
