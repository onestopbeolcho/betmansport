import re

def parse_logs():
    with open(r'c:\Smart_Proto_Investor_Plan\logs2.txt', 'r', encoding='utf-16le') as f:
        with open(r'c:\Smart_Proto_Investor_Plan\parsed_logs.txt', 'w', encoding='utf-8') as out:
            for line in f:
                if 'gemini' in line.lower() or 'blogger' in line.lower() or 'error' in line.lower():
                    out.write(line)

if __name__ == "__main__":
    parse_logs()
