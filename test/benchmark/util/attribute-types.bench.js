/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const isValidType = require('#agentlib/util/attribute-types.js')
const benchmark = require('#testlib/benchmark.js')

const types = {
  symbol: Symbol('test'),
  object: {},
  function: function () {},
  undef: undefined,
  string: 'test',
  number: 1234,
  boolean: true,
  array: []
}

const suite = benchmark.createBenchmark({
  name: 'isValidType'
})

Object.keys(types).forEach(function (type) {
  suite.add({
    name: type,
    fn: function () {
      return isValidType(types[type])
    }
  })
})

suite.run()
