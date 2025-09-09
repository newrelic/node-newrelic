/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('#testlib/benchmark.js')
const shimmer = require('#agentlib/shimmer.js')

const suite = benchmark.createBenchmark({ name: 'shimmer subscribers' })

suite.add({
  name: 'shimmer.setupSubscribers()',
  agent: true,
  fn: function (agent) {
    return shimmer.setupSubscribers(agent)
  },
})

suite.run()
