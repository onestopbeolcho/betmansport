
$IP = "3.26.129.31"
$KEY = "backend\awskey\smart-proto-key.pem"
$REMOTE_USER = "ubuntu"
$ARCHIVE = "deploy_package.tar.gz"

Write-Host "🚀 Starting Optimized Deployment to AWS ($IP)..."

# 1. Clean up old archive
if (Test-Path $ARCHIVE) { Remove-Item $ARCHIVE }

# 2. Create Archive (excluding heavy folders)
Write-Host "📦 Archiving files..."
# Windows tar might handle excludes differently, trying standard GNU tar syntax often works in modern Windows.
# If not, we might need to be specific.
# Put exclusions first for compatibility
tar -czf $ARCHIVE --exclude "node_modules" --exclude ".next" --exclude "__pycache__" --exclude ".git" --exclude "venv" backend frontend docker-compose.yml .env

if (-not (Test-Path $ARCHIVE)) {
    Write-Error "Failed to create archive!"
    exit 1
}

# 3. Create remote folder
Write-Host "1. Preparing remote directory..."
ssh -i $KEY -o StrictHostKeyChecking=no $REMOTE_USER@$IP "mkdir -p ~/app"

# 4. Upload Package
Write-Host "2. Uploading deployment package ($ARCHIVE)..."
$DEST = "${REMOTE_USER}@${IP}:~/app/"
scp -i $KEY $ARCHIVE $DEST

# 5. Extract and Deploy
Write-Host "3. Extracting and Building on Server..."
# Careful: We use 'docker system prune -af' to clear space (removes all unused images) 
# because the t2.micro likely ran out of disk. 
# We do NOT prune volumes to protect the database.
$SCRIPT = "cd ~/app && sudo docker-compose down && sudo docker system prune -af && tar -xzf $ARCHIVE && sudo docker-compose up --build -d"

ssh -i $KEY $REMOTE_USER@$IP $SCRIPT

Write-Host "✅ Deployment Complete!"
Write-Host "Check status: ssh -i $KEY $REMOTE_USER@$IP 'docker-compose ps'"
