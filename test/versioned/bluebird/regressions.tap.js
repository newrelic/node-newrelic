/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var testsDir = '../../integration/instrumentation/promises'

var tap = require('tap')
var testRegressions = require(testsDir + '/regressions')


tap.test('bluebird', function(t) {
  t.autoend()

  t.test('regressions', function(t) {
    t.autoend()
    testRegressions(t, loadBluebird)
  })
})

function loadBluebird() {
  return require('bluebird') // Load relative to this file.
}
