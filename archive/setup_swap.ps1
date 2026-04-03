
$IP = "3.26.129.31"
$KEY = "backend\awskey\smart-proto-key.pem"
$REMOTE_USER = "ubuntu"

Write-Host "Configuring 2GB Swap Memory on $IP..."

# Check if swapfile exists, if not create it.
# Check if fstab has entry, if not add it.
$CMD = "if [ ! -f /swapfile ]; then sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile; fi && sudo swapon /swapfile || true && if ! grep -q '/swapfile' /etc/fstab; then echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab; fi && free -h"

ssh -i $KEY -o StrictHostKeyChecking=no $REMOTE_USER@$IP $CMD

Write-Host "✅ Swap Configured! You can now retry deployment."
