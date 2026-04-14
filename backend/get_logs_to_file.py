import subprocess
import json

def main():
    try:
        res = subprocess.run([
            'gcloud.cmd', 'logging', 'read', 
            'resource.type=cloud_run_revision AND resource.labels.service_name=scorenix-backend AND severity>=INFO', 
            '--limit=50', '--format=json'
        ], capture_output=True, text=True, encoding='utf-8')
        
        if res.returncode != 0:
            print("Failed to run gcloud:", res.stderr)
            return

        logs = json.loads(res.stdout)
        with open("clean_logs.txt", "w", encoding="utf-8") as f:
            for log in logs:
                f.write(f"[{log.get('timestamp', '')}] {log.get('textPayload', '').strip()}\n")
        print("Logs saved to clean_logs.txt")
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    main()
