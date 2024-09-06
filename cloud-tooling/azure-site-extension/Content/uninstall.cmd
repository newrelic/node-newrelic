:: Copyright 2024 New Relic Corporation. All rights reserved.
:: SPDX-License-Identifier: Apache-2.0

@echo off
setlocal enabledelayedexpansion

SET ROOT_DIR=%HOME%\site\wwwroot
SET NODE_MODULES=%ROOT_DIR%\node_modules

REM Uninstall newrelic if it exists
SET NEW_RELIC_FOLDER="%NODE_MODULES%\newrelic"
IF EXIST %NEW_RELIC_FOLDER% (
  echo Uninstalling newrelic...
  cd "%ROOT_DIR%"
  call npm uninstall newrelic --save
  IF !ERRORLEVEL! NEQ 0 (
    echo Failed to uninstall newrelic
    exit /b 1
  ) ELSE (
    echo Successfully uninstalled newrelic
  )
) ELSE (
  echo newrelic package not found in node_modules
)

REM Loop through directories starting with @ in node_modules
FOR /D %%G IN ("%NODE_MODULES%\@*") DO (
  SET "DIR_EMPTY=1"
  FOR /F %%A IN ('dir /a /b "%%G" 2^>nul') DO SET "DIR_EMPTY=0"
  IF !DIR_EMPTY!==1 (
    echo Removing empty directory: %%G
    rmdir /s /q "%%G"
    IF !ERRORLEVEL! NEQ 0 (
      echo Failed to remove directory: %%G
      exit /b 1
    )
  )
)

echo Script completed successfully
endlocal
exit /b 0
