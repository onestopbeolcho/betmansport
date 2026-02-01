$IP = "3.26.129.31"
$KEY = "backend\awskey\smart-proto-key.pem"
$REMOTE_USER = "ubuntu"

Write-Host "🚀 Starting Deployment to AWS ($IP)..."

# 1. Create folder on server
Write-Host "1. Creating remote directory..."
ssh -i $KEY -o StrictHostKeyChecking=no $REMOTE_USER@$IP "mkdir -p ~/app"

# 2. Copy Files (SCP)
Write-Host "2. Uploading code (backend + config)..."
# Construction destination string first to avoid PowerShell parsing errors with ':'
$DEST = "${REMOTE_USER}@${IP}:~/app/"

# Copy docker-compose
scp -i $KEY docker-compose.yml $DEST
# Copy backend folder
scp -i $KEY -r backend $DEST

# 3. Launch on Server
Write-Host "3. Building and Starting Containers on AWS..."
# Use legacy docker-compose (v1) because 'docker compose' (v2) is not installed on this AMI
ssh -i $KEY $REMOTE_USER@$IP "cd ~/app && sudo docker-compose down && sudo docker-compose up --build -d"

Write-Host "✅ Deployment Complete!"
Write-Host "Check status: ssh -i $KEY $REMOTE_USER@$IP 'docker-compose ps'"
