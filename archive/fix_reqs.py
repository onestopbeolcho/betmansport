import os

req_path = 'backend/requirements.txt'

try:
    # Try reading as UTF-16 (PowerShell default)
    with open(req_path, 'r', encoding='utf-16') as f:
        content = f.read()
except UnicodeError:
    # Fallback to UTF-8 or default
    with open(req_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

# Add asyncpg if missing
if 'asyncpg' not in content:
    content += '\nasyncpg'

# Write back as UTF-8
with open(req_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("requirements.txt fixed: UTF-8 + asyncpg")
