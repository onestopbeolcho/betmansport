with open(r"c:\Smart_Proto_Investor_Plan\frontend\app\components\Navbar.tsx", "r", encoding="utf-8", errors="ignore") as f:
    text = f.read()

idx = text.find("href: '/analysis'")
if idx != -1:
    print(text[idx-200:idx+300])
else:
    print("NOT FOUND")
