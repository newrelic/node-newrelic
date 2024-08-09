:: Copyright 2024 New Relic Corporation. All rights reserved.
:: SPDX-License-Identifier: Apache-2.0

SET NEW_RELIC_FOLDER="%HOME%\node_modules/newrelic"
IF EXIST %NEW_RELIC_FOLDER% (
  npm uninstall newrelic
)
