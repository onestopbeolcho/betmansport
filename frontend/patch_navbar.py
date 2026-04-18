import re
filepath = r"c:\Smart_Proto_Investor_Plan\frontend\app\components\Navbar.tsx"

with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

# Let's find the main NAV_LINKS or similar definition.
lines = text.split("\n")
new_lines = []
inserted = False

for i, line in enumerate(lines):
    new_lines.append(line)
    # the menu arrays usually look like: { href: `/${currentLang}/analysis`, label: dict?.nav?.analysis || "AI 분석" },
    if "/analysis" in line and "href" in line and not inserted:
        # Check if the surrounding is a menu array
        # Just inject it right after the analysis entry if it looks like an array element
        if "}," in line or "}" in line:
            indent = " " * (len(line) - len(line.lstrip()))
            
            # create the league entry
            # Usually label uses dict
            league_entry = f"{indent}{{ href: `/${{currentLang}}/league`, label: dict?.nav?.league || \"Prediction League\", description: \"Top Analysts Leaderboard\" }},"
            new_lines.append(league_entry)
            inserted = True

with open(filepath, "w", encoding="utf-8") as f:
    f.write("\n".join(new_lines))

if inserted:
    print("PATCH_SUCCESS")
else:
    print("TARGET_NOT_FOUND")
