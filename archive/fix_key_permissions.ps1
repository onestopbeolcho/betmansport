$path = "backend\awskey\smart-proto-key.pem"
Write-Host "Fixing permissions for $path..."

# 1. Reset to default
icacls $path /reset

# 2. Grant Read access to current user ONLY
icacls $path /grant:r "$($env:USERNAME):(R)"

# 3. Disable inheritance (removes everyone else)
icacls $path /inheritance:r

Write-Host "Permissions fixed. Try SSH now."
