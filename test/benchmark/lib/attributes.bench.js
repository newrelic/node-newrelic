/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('#testlib/benchmark.js')
const { Attributes } = require('#agentlib/attributes.js')
const AttributeFilter = require('#agentlib/config/attribute-filter.js')

const DESTINATIONS = AttributeFilter.DESTINATIONS
const TRANSACTION_SCOPE = Attributes.SCOPE_TRANSACTION

// The `Attributes` constructor reads the agent config via `Config.getInstance()`,
// so an agent must be loaded before instances can be created.
const suite = benchmark.createBenchmark({
  name: 'Attributes',
  runs: 200_000,
  agent: {
    config: {
      attributes: {
        enabled: true,
        include: ['request.headers.include-wild*'],
        exclude: ['request.headers.exclude-wild*']
      }
    }
  }
})

const tests = [
  {
    name: 'constructor',
    fn: construct
  },
  {
    name: 'isValidLength',
    before: freshInstance,
    fn: isValidLength
  },
  {
    name: '_set',
    before: freshInstance,
    fn: set
  },
  {
    name: 'get',
    before: populatedInstance,
    fn: get
  },
  {
    name: 'has',
    before: populatedInstance,
    fn: has
  },
  {
    name: 'reset',
    before: populatedInstance,
    fn: reset
  },
  {
    name: 'addAttribute',
    before: freshInstance,
    fn: addAttribute
  },
  {
    name: 'addAttributes',
    before: freshInstance,
    fn: addAttributes
  },
  {
    name: 'hasValidDestination',
    before: freshInstance,
    fn: hasValidDestination
  }
]

for (const test of tests) {
  suite.add(test)
}
suite.run()

function freshInstance() {
  return { inst: new Attributes({ scope: TRANSACTION_SCOPE }) }
}

function populatedInstance() {
  const inst = new Attributes({ scope: TRANSACTION_SCOPE })
  inst.addAttribute(DESTINATIONS.TRANS_SCOPE, 'one', '1')
  inst.addAttribute(DESTINATIONS.TRANS_SCOPE, 'two', '2')
  return { inst }
}

function construct() {
  // eslint-disable-next-line no-new
  new Attributes({ scope: TRANSACTION_SCOPE })
}

function isValidLength(agent, { inst }) {
  inst.isValidLength('some.attribute.name')
}

function set(agent, { inst }) {
  inst._set(DESTINATIONS.TRANS_SCOPE, 'test', 'success', false)
}

function get(agent, { inst }) {
  inst.get(DESTINATIONS.TRANS_SCOPE)
}

function has(agent, { inst }) {
  inst.has('one')
}

function reset(agent, { inst }) {
  inst.reset()
}

function addAttribute(agent, { inst }) {
  inst.addAttribute(DESTINATIONS.TRANS_SCOPE, 'test', 'success')
}

function addAttributes(agent, { inst }) {
  inst.addAttributes(DESTINATIONS.TRANS_SCOPE, { one: '1', two: '2', three: '3' })
}

function hasValidDestination(agent, { inst }) {
  inst.hasValidDestination(DESTINATIONS.TRANS_SCOPE, 'test')
}
