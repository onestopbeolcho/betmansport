with open("ml_output.txt", "r", encoding="cp949", errors="ignore") as f:
    text = f.read()

with open("ml_clean.md", "w", encoding="utf-8") as f:
    f.write(text)
