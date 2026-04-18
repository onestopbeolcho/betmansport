with open(r"c:\Smart_Proto_Investor_Plan\frontend\typescript_errors.txt", "rb") as f:
    text = f.read().decode("utf-16le", errors="ignore")

with open(r"c:\Smart_Proto_Investor_Plan\frontend\typescript_errors_utf8.txt", "w", encoding="utf-8") as f:
    f.write(text)
