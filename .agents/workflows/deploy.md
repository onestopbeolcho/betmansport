---
description: 프론트엔드 빌드 및 Firebase 배포를 한 번에 실행합니다
---

# 배포 워크플로우

프론트엔드를 빌드하고 Firebase에 배포합니다.

1. 프론트엔드 빌드를 시작합니다.
```powershell
cd c:\Smart_Proto_Investor_Plan\frontend; npm run build
```

2. 빌드 결과를 확인합니다.
```powershell
if (Test-Path "c:\Smart_Proto_Investor_Plan\frontend\out") { $count = (Get-ChildItem -Recurse "c:\Smart_Proto_Investor_Plan\frontend\out" -File).Count; Write-Host "✅ 빌드 성공: $count 파일 생성됨" } else { Write-Host "❌ 빌드 실패: out 디렉토리 없음" }
```

3. Firebase 배포를 진행합니다 (사용자에게 확인 후).
```powershell
cd c:\Smart_Proto_Investor_Plan; firebase deploy --only hosting,functions
```

4. 배포 완료 후 라이브 사이트를 확인합니다.
