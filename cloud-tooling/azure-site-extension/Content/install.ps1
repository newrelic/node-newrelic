# Define paths
$extensionModulesPath = "$PSScriptRoot\node_modules"
$appRootPath = "D:\home\site\wwwroot"
$userModulesPath = "$appRootPath\node_modules"

# Function to copy contents from extension's node_modules to user's node_modules
function Copy-NodeModules {
    param (
        [string]$sourcePath,
        [string]$destinationPath
    )

    if (Test-Path -Path $sourcePath) {
        Write-Output "Source path exists: $sourcePath"
        
        if (-not (Test-Path -Path $destinationPath)) {
            Write-Output "Destination path does not exist: $destinationPath"
            Write-Output "Creating destination directory..."
            New-Item -ItemType Directory -Path $destinationPath
        }

        Write-Output "Copying node_modules from $sourcePath to $destinationPath..."
        Copy-Item -Path "$sourcePath\*" -Destination $destinationPath -Recurse -Force
        Write-Output "Copy complete."
    } else {
        Write-Output "Source path does not exist: $sourcePath. Skipping copy."
    }
}

# Call the function
Copy-NodeModules -sourcePath $extensionModulesPath -destinationPath $userModulesPath