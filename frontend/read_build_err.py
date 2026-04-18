with open(r"c:\Smart_Proto_Investor_Plan\frontend\build_err.txt", "r", encoding="utf-8", errors="ignore") as f:
    text = f.read()

with open(r"c:\Smart_Proto_Investor_Plan\frontend\build_err_tail.txt", "w", encoding="utf-8") as f:
    f.write(text[-2000:])
