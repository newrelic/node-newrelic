/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const exec = require('child_process').execSync
exec(
  'NEW_RELIC_FEATURE_FLAG_LEGACY_CONTEXT_MANAGER=1 NEW_RELIC_FEATURE_FLAG_UNRESOLVED_PROMISE_CLEANUP=false node --expose-gc ./async-hooks.js',
  {
    stdio: 'inherit',
    cwd: __dirname
  }
)
