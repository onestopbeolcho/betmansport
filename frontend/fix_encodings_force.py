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
                # Need to force fix
                print(f"Force fixing: {path}")
                with open(path, "rb") as file:
                    b_content = file.read()
                
                # decode ignoring errors
                content = b_content.decode("utf-8", errors="ignore")
                
                with open(path, "w", encoding="utf-8") as file:
                    file.write(content)
