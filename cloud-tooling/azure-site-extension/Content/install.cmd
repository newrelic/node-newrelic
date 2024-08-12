:: Copyright 2022 New Relic Corporation. All rights reserved.
:: SPDX-License-Identifier: Apache-2.0

@echo off

powershell.exe -ExecutionPolicy RemoteSigned -File install.ps1

echo %ERRORLEVEL%
