/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// run capture params tests
var runTests = require('../../../integration/instrumentation/hapi/capture-params')
var utils = require('./hapi-utils')

runTests(function() {
  return utils.getServer()
})
