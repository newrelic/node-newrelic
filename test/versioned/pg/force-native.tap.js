/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var runTests = require('./pg.common.js')

runTests('forced native', function getClient() {
  // setting env var for forcing native
  process.env.NODE_PG_FORCE_NATIVE = true
  var pg = require('pg')
  delete process.env.NODE_PG_FORCE_NATIVE
  return pg
})
