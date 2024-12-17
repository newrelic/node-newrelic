/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const tspl = require('@matteo.collina/tspl')

const Config = require('../../../lib/config')
const helper = require('../../lib/agent_helper')
const tests = require('../../lib/cross_agent_tests/attribute_configuration')

const DEST_TO_ID = {
  transaction_events: 0x01,
  transaction_tracer: 0x02,
  error_collector: 0x04,
  browser_monitoring: 0x08,
  span_events: 0x10,
  transaction_segments: 0x20
}

// simplified version of lodash set()
function setPath(obj, path, value) {
  const paths = path.split('.')
  while (paths.length - 1) {
    const key = paths.shift()
    if (!(key in obj)) {
      obj[key] = {}
    }
    obj = obj[key]
  }
  obj[paths[0]] = value
}

test('Attribute include/exclude configurations', async (t) => {
  const plan = tspl(t, { plan: tests.length })

  const agent = helper.loadMockedAgent()
  t.after(() => {
    helper.unloadAgent(agent)
  })

  for (const tst of tests) {
    runTest(plan, tst)
  }

  await plan.completed
})

function runTest(plan, test) {
  // The tests list the configurations in flat, dot notation (i.e.
  // `transaction_tracer.attributes.enabled`). We need to expand that into a
  // deep object in order for our config to load it as though it came from the
  // `newrelic.js` file.
  let config = Object.keys(test.config).reduce(function (conf, key) {
    setPath(conf, key, test.config[key])
    return conf
  }, {})
  config = new Config(config)

  // Filter the destinations.
  const destinations = test.input_default_destinations.filter(function (dest) {
    const destId = DEST_TO_ID[dest]
    return config.attributeFilter.filterAll(destId, test.input_key) & destId
  })

  try {
    plan.deepStrictEqual(destinations, test.expected_destinations, test.testname)
  } catch {
    // If not, log the test information to make debugging easier.
    plan.diagnostic(
      JSON.stringify(
        {
          input: test.config,
          key: test.input_key,
          ___: '___',
          attrs: config.attributes,
          trace_attrs: config.transaction_tracer.attributes,
          tx_event_attrs: config.transaction_events.attributes,
          error_attrs: config.error_collector.attributes,
          browser_attrs: config.browser_monitoring.attributes
        },
        null,
        2
      )
    )
  }
}
