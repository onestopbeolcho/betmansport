$env:PATH += ";C:\Users\청솔\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin"

Write-Host "Creating Scheduler Job..."
gcloud scheduler jobs create http blogger-daily-post `
    --schedule="0 11 * * *" `
    --time-zone="Asia/Seoul" `
    --uri="https://scorenix-backend-n5dv44kdaa-du.a.run.app/api/blogger/post" `
    --http-method=POST `
    --project=smart-proto-inv-2026 `
    --location=asia-northeast3 `
    2>&1 | Out-File -FilePath c:\Smart_Proto_Investor_Plan\sched_out2.txt -Encoding utf8
