############################################################
# Copyright 2022 New Relic Corporation. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
############################################################

# Install.ps1
#
# This version uses npm install, which we're not going to want to do
# in the released version

try {
	WriteToInstallLog "Start executing install.ps1"

	# Selects the agent version
	$agentVersion = "latest"
	if ($env:NEWRELIC_AGENT_VERSION_OVERRIDE -ne $null) {
		$agentVersion = $env:NEWRELIC_AGENT_VERSION_OVERRIDE.ToString()
		WriteToInstallLog "Installing Node agent version $agentVersion"
	} else {
		WriteToInstallLog "Installing the latest Node agent"
	}

	WriteToInstallLog "Executing npm install newrelic@latest"
    npm install newrelic@latest

	WriteToInstallLog "End executing install.ps1."
	WriteToInstallLog "-----------------------------"
	exit $LASTEXITCODE
}
catch
{
	$errorMessage = $_.Exception.Message
	$errorLine = $_.InvocationInfo.ScriptLineNumber
	WriteToInstallLog "Error at line $errorLine : $errorMessage"
	WriteToInstallLog "Explicitly adding node to path"
    SET PATH=C:\Program Files\Nodejs;%PATH%
    WriteToInstallLog "Executing npm install newrelic@latest"
    npm install newrelic@latest
	WriteToInstallLog "End executing install.ps1."
	WriteToInstallLog "-----------------------------"

	exit $LASTEXITCODE
}
