$env:PATH += ";C:\Users\청솔\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin"

Write-Host "Enabling Cloud Scheduler API..."
gcloud services enable cloudscheduler.googleapis.com --project smart-proto-inv-2026 2>&1

Write-Host "Creating Scheduler Job..."
gcloud scheduler jobs create http blogger-daily-post `
    --schedule="0 11 * * *" `
    --timezone="Asia/Seoul" `
    --uri="https://scorenix-backend-n5dv44kdaa-du.a.run.app/api/blogger/post" `
    --http-method=POST `
    --project=smart-proto-inv-2026 `
    --location=asia-northeast3 `
    2>&1
