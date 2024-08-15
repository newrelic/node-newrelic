# Azure Node Agent Site Extension

This project creates an Azure site extension that automatically installs the New Relic Node Agent. This extension is designed for JVM applications running on Azure Windows compute resources. The site extensions follow [semantic versioning conventions](https://semver.org/). You can expect to find artifacts in [Nuget](https://www.nuget.org/). 

## Installation

This extension is designed for Node applications running on Azure Windows compute resources.

**Note:** Make sure that the target application is stopped prior to installing the extension.

From the Azure Home page, do the following:
- Click the App Services tile
- Click the name of the target application in the displayed list
- On the options listed on the left, scroll down to "Extensions" located under the `Development Tools` category
- Click on `+ Add` at the top of the page
- From the extension drop down, select `New Relic Node Agent`
- Click on the `Accept Legal Terms` link
- Click `OK` on the bottom left of the page
- Again, click `OK` on the bottom left of the page. This will begin installation of the extension

Once installed, the extension creates the following artifacts:
- Folder: `C:\home\node_modules\newrelic` - Contains the Node agent artifacts
- XDT: `applicationHost.xdt` that will add the necessary environment variable on application startup

If the extension fails to install, a log file is created at `C:\home\SiteExtensions\NewRelic.Azure.WebSites.Extension.NodeAgent\install.log`.

## Getting Started

Once the site extension is installed, you'll need to manually enter two configuration items before restarting your application:
- On the options listed on the left, scroll down to "Configuration" located under the `Settings` category
- On the configuration page, add the following two app settings:
    - `NEW_RELIC_LICENSE_KEY` - Your New Relic license key value
	- `NEW_RELIC_APP_NAME` - The name you wish your application to show up as in the New Relic Platform
	
You can also add any additional [app settings](https://docs.newrelic.com/docs/apm/agents/node-agent/configuration/node-agent-configuration-config-file/#Environment_Variables) to configure the agent as needed.

## Building

### Installing Dependencies (for MacOS and Linux)

- Download and install the latest version of [Mono](https://www.mono-project.com/download/stable/)
- Download `nuget.exe`: `sudo curl -o /usr/local/bin/nuget.exe https://dist.nuget.org/win-x86-commandline/latest/nuget.exe`
- Create an alias in your .bashrc or .zshrc for mono: `alias nuget="mono /usr/local/bin/nuget.exe"`
- Download and install [.Net 6](https://dotnet.microsoft.com/en-us/download/dotnet/6.0). Using the installer will create a `dotnet` command that will be available when you restart your shell.
- Restart your shell and execute `nuget` to verify your mono installation and `dotnet` to verify your .Net installation.

References:
- https://www.wiliam.com.au/wiliam-blog/creating-a-nuget-package
- https://learn.microsoft.com/en-au/nuget/install-nuget-client-tools#nugetexe-cli

### Publishing the Package

#### Publishing the Package with the Script (recommended)
- Your nuget package version is hardcoded in `version.txt`, update the file to change the version number.
- Run `./publish.sh <NUGET_API_KEY> <NUGET_SOURCE>`: this will create the NuGet package and upload to the target repository
- The parameters for `publish.sh` are the following:
	- `NUGET_API_KEY` - API key for uploading artifacts to the target NuGet repository
	- `NUGET_SOURCE` - Target NuGet repository (https://api.nuget.org/v3/index.json is the main, public URL)

#### Manually publishing the Package

- Change into the folder where the `.nuget` file exists
- Replace `{VERSION}` in `NewRelic.Azure.WebSites.Extension.NodeAgent.nuspec` with a version number you want to push. (DO NOT COMMIT THIS CHANGE)
- Execute: `nuget pack NewRelic.Azure.WebSites.Extension.NodeAgent.nuspec`
- This will create a package with the name: `NewRelic.Azure.WebSites.Extension.NodeAgent.VERSION.nupkg`
- Execute: `dotnet nuget push NewRelic.Node.Azure.WebSites.Extension.nupkg --api-key NUGET_API_KEY --source NUGET_SOURCE` where `NUGET_API_KEY` is your NuGet API key and `NUGET_SOURCE` is the URL of the target NuGet site (https://api.nuget.org/v3/index.json is the main, public URL)

For testing the extension, it is best to publish to a personel [MyGet repository](https://www.myget.org/). There you can publish and release packages without worrying about pushing your extension out to the publix.

## Testing

It is recommended you use a personnel repository created in [MyGet](https://www.myget.org/).

Upload the nuget package then set up an app config variable in Azure:
- `SCM_SITEEXTENSIONS_FEED_URL`: The URL to the private Nuget repository created when registering your myget.org account. For example: https://www.myget.org/F/username-nuget-test/api/v3/index.json

In Azure, when you browse to `Development Tools` > `Extensions`, you will see a list of Nuget packages in your private repository.


## Extension Source Files

Below is a description of the files that make up the extension. This can be helpful for future maintenance on the extension or for the creation of another Site Extension.

- `README.md` - This file
- `NewRelic.Azure.WebSites.Extension.NodeAgent.nuspec` - Contains the metadata about the target extension: Name, authors, copyright, etc. [Nuspec Format](https://learn.microsoft.com/en-us/nuget/reference/nuspec)
- `publish.sh` - Simple script to package the script and upload to the Nuget repository
- `Content/applicationHost.xdt` - XDT transformation to add the necessary agent startup environment variable to the app config when the app starts up
- `Content/install.cmd` - Simple batch file that wraps a call to the Powershell `install.ps1` script
- `Content/install.ps1` - Powershell script that downloads the agent bundle and installs it to the proper location on the host
- `Content/uninstall.cmd` - Simple batch file that will remove the Node installtion artifacts when the extension is removed
