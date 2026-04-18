import os

basedir = r"c:\Smart_Proto_Investor_Plan\frontend\app"

for root, dirs, files in os.walk(basedir):
    for f in files:
        if f.endswith((".tsx", ".ts", ".js", ".jsx", ".mjs")):
            path = os.path.join(root, f)
            try:
                with open(path, "r", encoding="utf-8") as file:
                    file.read()
            except UnicodeDecodeError:
                # Need to fix
                try:
                    with open(path, "r", encoding="cp949") as file:
                        content = file.read()
                    with open(path, "w", encoding="utf-8") as file:
                        file.write(content)
                    print(f"Fixed: {path}")
                except Exception as e:
                    print(f"Failed to fix {path}: {e}")
