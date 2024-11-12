/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const poolingTests = require('./pooling')
const constants = require('./constants')

poolingTests({
  factory: () => require('mysql'),
  poolFactory: () => require('generic-pool'),
  constants
})
