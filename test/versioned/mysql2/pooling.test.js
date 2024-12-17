/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const poolingTests = require('../mysql/pooling')
const constants = require('./constants')

poolingTests({
  factory: () => require('mysql2'),
  poolFactory: () => require('generic-pool'),
  constants
})
