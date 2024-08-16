# Azure Node Agent Site Extension

This project creates an Azure site extension that automatically installs the New Relic Node Agent. This extension is designed for Node applications running on Azure Windows compute resources. The site extensions follow [semantic versioning conventions](https://semver.org/). You can expect to find artifacts in [Nuget](https://www.nuget.org/). 

## Installation

Applying the site extension will install the New Relic Node agent. 

## Configuration

The Node agent can be started by adding `-r newrelic` to your application's `start` command, or by adding `-r newrelic` to the `NODE_OPTIONS` environment variable.

The New Relic Node agent is configured with the `newrelic.js` file, or via environment variables. [See our documentation for more detailed configuration](https://docs.newrelic.com/docs/apm/agents/nodejs-agent/installation-configuration/nodejs-agent-configuration/).

