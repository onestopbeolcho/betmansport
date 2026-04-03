---
description: 백엔드를 Cloud Run(scorenix-backend)에 배포합니다
---

# 백엔드 배포 워크플로우

⚠️ **반드시 scorenix-backend 서비스에 배포해야 합니다!**
프론트엔드는 이 서비스 URL을 참조합니다.
다른 서비스(api, smart-proto-backend)에 배포하면 사이트에 반영되지 않습니다.

// turbo-all

1. gcloud PATH 설정 및 Cloud Run 배포를 실행합니다.
```powershell
$env:PATH += ";C:\Users\청솔\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin"; gcloud run deploy scorenix-backend --source . --region asia-northeast3 --project smart-proto-inv-2026 --allow-unauthenticated --memory 512Mi --timeout 300 --clear-base-image 2>&1 | Out-File -FilePath "c:\Smart_Proto_Investor_Plan\deploy_log.txt" -Encoding utf8
```
작업 디렉토리: `c:\Smart_Proto_Investor_Plan\backend`

2. 배포 결과를 확인합니다.
```powershell
Get-Content "c:\Smart_Proto_Investor_Plan\deploy_log.txt" | Select-Object -Last 15
```

3. API 헬스체크를 수행합니다.
```powershell
$r = Invoke-WebRequest -Uri "https://scorenix-backend-n5dv44kdaa-du.a.run.app/" -UseBasicParsing -TimeoutSec 15; Write-Host "STATUS: $($r.StatusCode)"
```
