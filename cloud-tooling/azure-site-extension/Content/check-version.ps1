# Define the path to the node_modules directory and the package to check
$UserNodeModulesPath = "$env:HOME"
$packageName = "newrelic"

Write-Output "Checking installed version..."

# Get installed version using npm list
$installedVersionOutput = & npm ls $packageName --prefix $UserNodeModulesPath | Select-String -Pattern "$packageName@(\S+)"

if ($installedVersionOutput) {
    $UserVersion = $installedVersionOutput.Matches.Groups[1].Value
} else {
    $UserVersion = ""
}

Write-Output "Installed version is: $installedVersionOutput"
Write-Output "User version: $UserVersion"

if ($UserVersion -eq "") {
    Write-Output "User package not found. Running install.ps1..."
    & powershell.exe -ExecutionPolicy RemoteSigned -File .\install.ps1
    exit $LASTEXITCODE
} else {
    Write-Output "Installed version: $UserVersion"
    
    Write-Output "Getting latest version from npm..."
    $LatestVersion = npm show $packageName version
    
    Write-Output "Latest version: $LatestVersion"

    if ($UserVersion -ne $LatestVersion) {
        Write-Output "Installed version ($UserVersion) does not match latest version ($LatestVersion). Running install.ps1..."
        & powershell.exe -ExecutionPolicy RemoteSigned -File .\install.ps1
        exit $LASTEXITCODE
    } else {
        Write-Output "Installed version ($UserVersion) matches the latest version ($LatestVersion). Skipping install.ps1..."
        exit 0
    }
}
