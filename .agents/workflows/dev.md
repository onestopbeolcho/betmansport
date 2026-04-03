---
description: 프론트엔드 개발서버와 백엔드를 함께 시작합니다
---

# 개발 서버 시작 워크플로우

// turbo-all

1. 백엔드 서버를 시작합니다 (port 8000).
```powershell
cd c:\Smart_Proto_Investor_Plan\backend; Start-Process -FilePath "c:\Smart_Proto_Investor_Plan\venv\Scripts\python.exe" -ArgumentList "-m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload" -WorkingDirectory "c:\Smart_Proto_Investor_Plan\backend" -WindowStyle Minimized
```

2. 프론트엔드 개발 서버를 시작합니다 (port 3000).
```powershell
cd c:\Smart_Proto_Investor_Plan\frontend; npm run dev
```

3. 서버가 준비될 때까지 5초 기다린 후 상태를 확인합니다.
```powershell
Start-Sleep -Seconds 5; $ProgressPreference = 'SilentlyContinue'; try { $b = (Invoke-WebRequest "http://localhost:8000" -UseBasicParsing -TimeoutSec 5).StatusCode; Write-Host "✅ 백엔드 (port 8000): $b" } catch { Write-Host "❌ 백엔드 (port 8000): DOWN" }; try { $f = (Invoke-WebRequest "http://localhost:3000" -UseBasicParsing -TimeoutSec 5).StatusCode; Write-Host "✅ 프론트엔드 (port 3000): $f" } catch { Write-Host "⏳ 프론트엔드 아직 시작 중..." }
```
