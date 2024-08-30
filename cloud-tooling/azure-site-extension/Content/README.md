# Azure Node Agent Site Extension

This project creates an Azure site extension that automatically installs the New Relic Node Agent. This extension is designed for Node applications running on Azure Windows compute resources. The site extensions follow [semantic versioning conventions](https://semver.org/). You can expect to find artifacts in [Nuget](https://www.nuget.org/). 

## Installation

Applying the site extension will install the New Relic Node agent. 

From the Azure Home page, do the following:
- Click the App Services tile
- Click the name of the target application in the displayed list
- On the options listed on the left, scroll down to "Extensions" located under the Development Tools category
- Click on + Add at the top of the page
- From the extension drop down, select New Relic Node Agent
- Check the box for accepting the legal terms
- Click Add on the bottom of the page. This will begin installation of the extension.

Once installed, the extension creates the following artifacts:

- Folder: `C:\home\SiteExtensions\NewRelic.Azure.Websites.Extension.NodeAgent`
- XDT: `applicationHost.xdt` that will add the necessary `NODE_OPTIONS` environment variable on application startup

If the extension fails to install, a log file is created at `C:\home\SiteExtensions\NewRelic.Azure.Websites.Extension.NodeAgent\install.log`.

## Configuration
The New Relic Node agent is configured with the `newrelic.js` file, or via environment variables. [See our documentation for more detailed configuration](https://docs.newrelic.com/docs/apm/agents/nodejs-agent/installation-configuration/nodejs-agent-configuration/).

Once the site extension is installed, you'll need to manually enter one configuration item before restarting your application.
  - On the options listed on the left, scroll down to "Environment variables" located under the "Settings" category and add the following:
    - `NEW_RELIC_LICENSE_KEY` - Your New Relic license key value

The Node agent automatically adds the `NODE_OPTIONS` environment variable with a value of `-r newrelic` which starts the agent. 
  - Note: Any previously `NODE_OPTIONS` will be removed and reset with `-r newrelic`. 

## Extension Source Files
Below is a description of the files that make up the extension. This can be helpful for future maintenance on the extension or for the creation of another Site Extension.

  - `README.md` - This file
  - `NewRelic.Azure.WebSites.Extension.NodeAgent.nuspec` - Contains the metadata about the target extension: Name, authors, copyright, etc. Nuspec Format
  - `Content/applicationHost.xdt` - XDT transformation to add the necessary agent startup environment variable to the app config when the app starts up
  - `Content/install.cmd` - Simple batch file that wraps a call to the Powershell `install.ps1` script
  - `Content/install.ps1` - Powershell script that moves/installs the agent bundle to the proper location on the host
  - `Content/uninstall.cmd` - Simple batch file that will remove the Node installtion artifacts when the extension is removed


