import re
filepath = r"c:\Smart_Proto_Investor_Plan\frontend\app\components\Navbar.tsx"

with open(filepath, "r", encoding="cp949") as f:
    text = f.read()

lines = text.split("\n")
new_lines = []
inserted = False

for i, line in enumerate(lines):
    new_lines.append(line)
    if ("/analysis" in line or "/predictions" in line) and "href" in line and not inserted:
        if "}," in line or "}" in line:
            indent = " " * (len(line) - len(line.lstrip()))
            # Usually label uses dict
            league_entry = f"{indent}{{ href: `/${{currentLang}}/league`, label: dict?.nav?.league || \"Prediction League\", description: \"Top Analysts Leaderboard\" }},"
            new_lines.append(league_entry)
            inserted = True

with open(filepath, "w", encoding="cp949") as f:
    f.write("\n".join(new_lines))

if inserted:
    print("PATCH_SUCCESS")
else:
    print("TARGET_NOT_FOUND")
