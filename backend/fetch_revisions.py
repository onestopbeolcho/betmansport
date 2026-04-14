import subprocess

def main():
    cmd = [
        "gcloud.cmd", "run", "revisions", "list",
        "--service", "scorenix-backend",
        "--region", "asia-northeast3",
        "--project", "smart-proto-inv-2026"
    ]
    try:
        out = subprocess.check_output(cmd, text=True, encoding='utf-8')
        with open("revisions.txt", "w", encoding="utf-8") as f:
            f.write(out)
        print("Success")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
