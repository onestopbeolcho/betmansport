with open("phase2_output.txt", "r", encoding="utf-8", errors="ignore") as f:
    text = f.read()

with open("phase2_clean.md", "w", encoding="utf-8") as f:
    f.write(text)
