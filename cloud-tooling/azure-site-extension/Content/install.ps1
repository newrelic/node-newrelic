# Define paths
$extensionModulesPath = "$PSScriptRoot\node_modules"
$appRootPath = "$env:HOME\site\wwwroot"
$userModulesPath = "$appRootPath\node_modules"

# Define the path to the node_modules directory and the package to check
$UserNodeModulesPath = "$env:HOME"
$packageName = "newrelic"

WriteToInstallLog "Explicitly adding node to path"
$env:PATH = "C:\Program Files\Nodejs;" + $env:PATH

function WriteToInstallLog($output)
{
	$logPath = (Split-Path -Parent $PSCommandPath) + "\install.log"
	Write-Output "[$(Get-Date)] -- $output" | Out-File -FilePath $logPath -Append
}

function Check-Version {
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
  
  # Check if user package exists
  if ($UserVersion -eq "") {
    WriteToInstallLog "User package not found. Running install.ps1..."
    Copy-NodeModules -sourcePath $extensionModulesPath -destinationPath $userModulesPath
    exit $LASTEXITCODE
  } else {
    WriteToInstallLog "Installed version: $UserVersion"
    WriteToInstallLog "Getting latest version from npm..."

    $LatestVersion = npm show $packageName version
    WriteToInstallLog "Latest version: $LatestVersion"
  
    # Check if user package version matches the latest version
    if ($UserVersion -ne $LatestVersion) {
      WriteToInstallLog "Installed version ($UserVersion) does not match latest version ($LatestVersion). Running install.ps1..."
      Copy-NodeModules -sourcePath $extensionModulesPath -destinationPath $userModulesPath
      exit $LASTEXITCODE
    } else {
      WriteToInstallLog "Installed version ($UserVersion) matches the latest version ($LatestVersion). Skipping install.ps1..."
      exit 0
    }
  }
}

# Function to move contents from extension's node_modules to user's node_modules
function Copy-NodeModules {
  param (
      [string]$sourcePath,
      [string]$destinationPath
  )

  try {
    WriteToInstallLog "Start executing install.ps1"

    # Check if extension's node_module directory exists
    if (Test-Path -Path $sourcePath) {
      WriteToInstallLog "Source path exists: $sourcePath"

      # Check if user's node_modules directory exists and create if it doesn't
      if (-not (Test-Path -Path $destinationPath)) {
        WriteToInstallLog "Destination path does not exist: $destinationPath"
        WriteToInstallLog "Creating destination directory..."
        WriteToInstallLog -ItemType Directory -Path $destinationPath
      }

      # Move node_modules from extension's node_modules directory to users
      WriteToInstallLog "Moving node_modules from $sourcePath to $destinationPath..."
      Move-Item -Path "$sourcePath\*" -Destination $destinationPath -Force

      WriteToInstallLog "Copy complete."
      WriteToInstallLog "End executing install.ps1."
      WriteToInstallLog "-----------------------------"
      exit $LASTEXITCODE
    } else {
      WriteToInstallLog "Source path does not exist: $sourcePath. Skipping copy."
    }
  } catch {
    $errorMessage = $_.Exception.Message
    $errorLine = $_.InvocationInfo.ScriptLineNumber
    WriteToInstallLog "Error at line $errorLine : $errorMessage"

    # Install node agent using npm
    WriteToInstallLog "Executing npm install newrelic@latest"
    npm install --prefix "$env:HOME\site\wwwroot" newrelic

    # Check if the installation was successful
    if ($LASTEXITCODE -ne 0) {
      WriteToInstallLog "npm install failed with exit code $LASTEXITCODE"
    } else {
      WriteToInstallLog "npm install completed successfully"
    }

    WriteToInstallLog "End executing install.ps1."
    WriteToInstallLog "-----------------------------"
    exit 1
  }
}

# Call the function
Check-Version
