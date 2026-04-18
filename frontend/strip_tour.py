import os
import re

def main():
    root_dir = r"c:\Smart_Proto_Investor_Plan\frontend\app"
    pattern = re.compile(r'\s*data-tour=(["\'])[^\1]*?\1')
    count = 0
    for subdir, _, files in os.walk(root_dir):
        for file in files:
            if file.endswith('.tsx'):
                filepath = os.path.join(subdir, file)
                try:
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                    
                    new_content, num_subs = pattern.subn('', content)
                    
                    if num_subs > 0:
                        with open(filepath, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        print(f"Removed from {filepath} ({num_subs} replacements)")
                        count += 1
                except Exception as e:
                    print(f"Failed on {filepath}: {e}")
    print(f"Total files modified: {count}")

if __name__ == "__main__":
    main()
