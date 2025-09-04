/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('../../lib/benchmark')
const shimmer = require('../../../lib/shimmer')

const suite = benchmark.createBenchmark({ name: 'shimmer wrapping' })

suite.add({
  name: 'shimmer.registerHooks()',
  agent: true,
  fn: function (agent) {
    return shimmer.registerHooks(agent)
  },
  after: function() {
    return shimmer.removeHooks()
  }
})

suite.add({
  name: 'shimmer.removeHooks()',
  fn: function () {
    return shimmer.removeHooks()
  }
})

suite.add({
  name: 'shimmer.bootstrapInstrumentation()',
  agent: true,
  fn: function (agent) {
    return shimmer.bootstrapInstrumentation(agent)
  },
  after: function() {
    return shimmer.removeHooks()
  }
})

suite.add({
  name: 'shimmer.registerInstrumentation()',
  fn: function () {
    return shimmer.registerInstrumentation({ moduleName: 'foobar' })
  }
})

suite.add({
  name: 'shimmer.reinstrument()',
  agent: true,
  fn: function (agent) {
    return shimmer.reinstrument(agent, '../test/lib/benchmark')
  }
})

suite.run()
