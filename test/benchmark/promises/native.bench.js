/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var shared = require('./shared')


var suite = shared.makeSuite('Promises')
shared.tests.forEach(function registerTest(testFn) {
  suite.add({
    defer: true,
    name: testFn.name,
    fn: testFn(Promise),
    agent: {
      config: {
        feature_flag: {await_support: false}
      }
    }
  })
})

suite.run()
