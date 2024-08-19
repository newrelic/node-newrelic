# Define the path to the node_modules directory and the package to check
$UserNodeModulesPath = "$env:HOME"
$packageName = "newrelic"

function WriteToInstallLog($output)
{
	$logPath = (Split-Path -Parent $PSCommandPath) + "\install.log"
	Write-Output "[$(Get-Date)] -- $output" | Out-File -FilePath $logPath -Append
}


WriteToInstallLog "Checking installed version..."

# Get installed version using npm list
$installedVersionOutput = & npm ls $packageName --prefix $UserNodeModulesPath | Select-String -Pattern "$packageName@(\S+)"

if ($installedVersionOutput) {
  $UserVersion = $installedVersionOutput.Matches.Groups[1].Value
} else {
  $UserVersion = ""
}

WriteToInstallLog "Installed version is: $installedVersionOutput"
WriteToInstallLog "User version: $UserVersion"

if ($UserVersion -eq "") {
  WriteToInstallLog "User package not found. Running install.ps1..."
  & powershell.exe -ExecutionPolicy RemoteSigned -File .\install.ps1
  exit $LASTEXITCODE
} else {
  WriteToInstallLog "Installed version: $UserVersion"
  
  WriteToInstallLog "Getting latest version from npm..."
  $LatestVersion = npm show $packageName version
  
  WriteToInstallLog "Latest version: $LatestVersion"

  if ($UserVersion -ne $LatestVersion) {
    WriteToInstallLog "Installed version ($UserVersion) does not match latest version ($LatestVersion). Running install.ps1..."
    & powershell.exe -ExecutionPolicy RemoteSigned -File .\install.ps1
    exit $LASTEXITCODE
  } else {
    WriteToInstallLog "Installed version ($UserVersion) matches the latest version ($LatestVersion). Skipping install.ps1..."
    exit 0
  }
}
