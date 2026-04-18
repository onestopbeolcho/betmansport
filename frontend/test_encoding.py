filepath = r"c:\Smart_Proto_Investor_Plan\frontend\app\components\Navbar.tsx"

for enc in ["utf-8", "cp949", "utf-16", "utf-8-sig"]:
    try:
        with open(filepath, "r", encoding=enc) as f:
            text = f.read()
        print(f"SUCCESS with {enc}")
        break
    except Exception as e:
        print(f"FAILED {enc}: {e}")
