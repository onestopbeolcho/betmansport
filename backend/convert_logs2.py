with open("phase2_output2.txt", "r", encoding="cp949", errors="ignore") as f:
    text = f.read()

with open("phase2_clean2.md", "w", encoding="utf-8") as f:
    f.write(text)
