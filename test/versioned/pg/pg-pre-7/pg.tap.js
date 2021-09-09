/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const runTests = require('./pg.common.js')

runTests('pure JavaScript', function getClient() {
  return require('pg')
})
