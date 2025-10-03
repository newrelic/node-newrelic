/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const basicTests = require('../mysql/basic')
const constants = require('./constants')
basicTests({
  lib: 'mysql2',
  factory: () => require('mysql2'),
  version: require('mysql2/package.json').version,
  poolFactory: () => require('generic-pool'),
  constants
})
