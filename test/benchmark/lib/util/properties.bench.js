/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('#testlib/benchmark.js')
const properties = require('#agentlib/util/properties.js')

const suite = benchmark.createBenchmark({
  runs: 100000,
  name: 'util.properties'
})

let testObj
suite.add({
  name: 'isEmpty (object instance)',
  before: function () {
    testObj = {}
  },
  fn: function testIsEmptyObjectPrototype() {
    properties.isEmpty(testObj)
  }
})

suite.add({
  name: 'isEmpty (null prototype)',
  before: function () {
    testObj = Object.create(null)
  },
  fn: function testIsEmptyNullPrototype() {
    properties.isEmpty(testObj)
  }
})

suite.run()
