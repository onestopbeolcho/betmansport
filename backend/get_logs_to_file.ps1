$env:PATH += ";C:\Users\청솔\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin"
gcloud run services logs read scorenix-backend --region asia-northeast3 --project smart-proto-inv-2026 --limit 200 > c:\Smart_Proto_Investor_Plan\logs.txt
