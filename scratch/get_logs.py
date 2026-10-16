# -*- coding: utf-8 -*-
"""
KST 19:05 ~ 19:30 (UTC 10:05 ~ 10:30) 사이의 필터링 없는 로우 로그 출력 스크립트
"""
import subprocess
import json
import os

def check_video_raw():
    start_str = "2026-07-17T10:05:00Z"
    end_str = "2026-07-17T10:30:00Z"
    
    log_filter = (
        'resource.type="cloud_run_revision" AND '
        'resource.labels.service_name="scorenix-backend" AND '
        f'timestamp >= "{start_str}" AND '
        f'timestamp <= "{end_str}"'
    )
    
    cmd = [
        "gcloud", "logging", "read",
        log_filter,
        "--project=smart-proto-inv-2026",
        "--limit=500",
        "--format=json"
    ]
    
    os.environ["PATH"] += ";C:\\Users\\청솔\\AppData\\Local\\Google\\Cloud SDK\\google-cloud-sdk\\bin"

    try:
        res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if res.returncode != 0:
            print("Error Stderr:", res.stderr)
            return

        logs = json.loads(res.stdout)
        logs.reverse()
        # 모든 로그를 가감 없이 출력
        for entry in logs:
            ts = entry.get("timestamp")
            payload = entry.get("textPayload") or entry.get("jsonPayload")
            print(f"[{ts}] {payload}")
                
    except Exception as e:
        print(f"Failed: {e}")

if __name__ == "__main__":
    check_video_raw()
