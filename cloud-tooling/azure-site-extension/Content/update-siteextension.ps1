# Define paths
$rootDir = Split-Path -Parent -Parent $PSScriptRoot
$versionFile = Join-Path $rootDir "version.txt"
$siteExtensionsJson = Join-Path $PSScriptRoot "siteextensions.json"

# Read the version from the version.txt file
$version = Get-Content $versionFile

# Read the current siteextensions.json content
$json = Get-Content $siteExtensionsJson -Raw | ConvertFrom-Json

# Update the version field
$json.version = $version

# Write the updated content back to siteextensions.json
$json | ConvertTo-Json -Depth 10 | Set-Content $siteExtensionsJson

Write-Output "Version updated to $version in siteextensions.json"
