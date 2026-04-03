---
description: 전체 페이지 404/500 에러를 자동으로 탐지하고 보고합니다
---

# 헬스체크 워크플로우

모든 페이지의 HTTP 상태를 점검합니다.

// turbo-all

1. 프론트엔드 개발 서버가 실행 중인지 확인합니다.
```powershell
$ProgressPreference = 'SilentlyContinue'; try { $r = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5; Write-Host "DevServer: OK ($($r.StatusCode))" } catch { Write-Host "DevServer: DOWN - 먼저 npm run dev 실행 필요" }
```

2. 모든 주요 페이지의 HTTP 상태를 점검합니다.
```powershell
$ProgressPreference = 'SilentlyContinue'; $pages = @("/ko", "/ko/bets", "/ko/analysis", "/ko/market", "/ko/mypage", "/ko/vip", "/ko/pricing", "/ko/manual", "/ko/login", "/ko/register", "/ko/terms", "/ko/privacy", "/ko/refund", "/ko/disclaimer", "/ko/payment/request"); $errors = @(); foreach ($p in $pages) { try { $r = Invoke-WebRequest -Uri "http://localhost:3000$p" -UseBasicParsing -TimeoutSec 10; $status = $r.StatusCode } catch { $status = $_.Exception.Response.StatusCode.value__; if (!$status) { $status = "TIMEOUT" } }; $icon = if ($status -eq 200) { "✅" } else { "❌"; $errors += "$p ($status)" }; Write-Host "$icon $p -> $status" }; if ($errors.Count -eq 0) { Write-Host "`n🎉 모든 페이지 정상!" } else { Write-Host "`n🚨 문제 발견: $($errors -join ', ')" }
```

3. 결과를 사용자에게 보고하고, 에러가 있으면 자동으로 원인을 조사합니다.
