:: Copyright 2024 New Relic Corporation. All rights reserved.
:: SPDX-License-Identifier: Apache-2.0

@echo off
REM Call the PowerShell script
powershell.exe -ExecutionPolicy Bypass -File .\install.ps1

REM Echo the exit code
echo %ERRORLEVEL%
