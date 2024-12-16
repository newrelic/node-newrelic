/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const basicTests = require('./basic')
const constants = require('./constants')
basicTests({
  lib: 'mysql',
  factory: () => require('mysql'),
  poolFactory: () => require('generic-pool'),
  constants
})
