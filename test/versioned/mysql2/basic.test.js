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
  poolFactory: () => require('generic-pool'),
  constants
})
