/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('../../lib/benchmark')
const shimmer = require('../../../lib/shimmer')

const suite = benchmark.createBenchmark({ name: 'shimmer wrapping', delay: 0.01 })

suite.add({
  name: 'shimmer.patchModule()',
  agent: true,
  fn: function (agent) {
    return shimmer.patchModule(agent)
  }
})

suite.add({
  name: 'shimmer.unpatchModule()',
  fn: function () {
    return shimmer.unpatchModule()
  }
})

suite.add({
  name: 'shimmer.bootstrapInstrumentation()',
  agent: true,
  fn: function (agent) {
    return shimmer.bootstrapInstrumentation(agent)
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
    return shimmer.reinstrument(agent, 'benchmark')
  }
})

suite.run()
