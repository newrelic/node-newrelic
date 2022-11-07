/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test
const metricPrefix = require('../../../lib/metrics/names').SUPPORTABILITY.PREFIX

test('Multiple require("newrelic")', function (t) {
  process.env.NEW_RELIC_ENABLED = true
  process.env.NEW_RELIC_APP_NAME = 'agent test'

  const path = require.resolve('../../../index.js')
  const first = require(path)

  delete require.cache[path]

  const second = require(path)

  t.equal(first, second)
  const doubleLoadMetric = second.agent.metrics.getOrCreateMetric(`${metricPrefix}Agent/DoubleLoad`)
  t.equal(doubleLoadMetric.callCount, 1, 'should have tried to double-load the agent once')
  t.end()
})
