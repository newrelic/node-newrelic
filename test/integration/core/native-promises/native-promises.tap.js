/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const exec = require('child_process').execSync
exec('node --expose-gc ./native-promises.js', {
  stdio: 'inherit',
  cwd: __dirname
})
