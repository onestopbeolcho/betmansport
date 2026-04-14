import subprocess
import sys

def main(keyword):
    cmd = [
        "gcloud.cmd", "logging", "read",
        f'resource.type="cloud_run_revision" AND resource.labels.service_name="scorenix-backend" AND textPayload:"{keyword}"',
        "--limit", "30",
        "--format", "table(timestamp, textPayload)",
        "--project", "smart-proto-inv-2026"
    ]
    try:
        out = subprocess.check_output(cmd, text=True, encoding='utf-8')
        print(out)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main(sys.argv[1])
