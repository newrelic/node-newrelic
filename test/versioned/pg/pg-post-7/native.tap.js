/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var runTests = require('./pg.common.js')

runTests('native', function getClient() {
  return require('pg').native
})
