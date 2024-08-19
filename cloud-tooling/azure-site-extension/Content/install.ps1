# Define paths
$extensionModulesPath = "$PSScriptRoot\node_modules"
$appRootPath = "$env:HOME\site\wwwroot"
$userModulesPath = "$appRootPath\node_modules"

function WriteToInstallLog($output)
{
	$logPath = (Split-Path -Parent $PSCommandPath) + "\install.log"
	Write-Output "[$(Get-Date)] -- $output" | Out-File -FilePath $logPath -Append
}

# Function to copy contents from extension's node_modules to user's node_modules
function Copy-NodeModules {
  param (
      [string]$sourcePath,
      [string]$destinationPath
  )

  try {
    WriteToInstallLog "Start executing install.ps1"

    if (Test-Path -Path $sourcePath) {
      WriteToInstallLog "Source path exists: $sourcePath"
        
        if (-not (Test-Path -Path $destinationPath)) {
          WriteToInstallLog "Destination path does not exist: $destinationPath"
          WriteToInstallLog "Creating destination directory..."
          WriteToInstallLog -ItemType Directory -Path $destinationPath
        }

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
    exit 1
  }
}

# Call the function
Copy-NodeModules -sourcePath $extensionModulesPath -destinationPath $userModulesPath
