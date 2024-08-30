:: Copyright 2024 New Relic Corporation. All rights reserved.
:: SPDX-License-Identifier: Apache-2.0

SET NEW_RELIC_FOLDER="%HOME%\site\wwwroot\node_modules\newrelic"
IF EXIST %NEW_RELIC_FOLDER% (
  echo Uninstalling newrelic...
  cd "%HOME%\site\wwwroot"
  call npm uninstall newrelic --save
  rmdir /s /q "%HOME%\site\wwwroot\node_modules\@newrelic"
  IF %ERRORLEVEL% NEQ 0 (
    echo Failed to uninstall newrelic
    exit /b 1
  ) ELSE (
    echo Successfully uninstalled newrelic
  )
) ELSE (
  echo newrelic package not found in node_modules
)
