import subprocess

def main():
    cmd = [
        "gcloud.cmd", "logging", "read",
        'resource.type="cloud_run_revision" AND resource.labels.service_name="scorenix-backend" AND textPayload:"SNS"',
        "--limit", "100",
        "--format", "table(timestamp, textPayload)",
        "--project", "smart-proto-inv-2026"
    ]
    try:
        out = subprocess.check_output(cmd, text=True, encoding='utf-8')
        print(out)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
