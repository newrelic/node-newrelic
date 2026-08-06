/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('#testlib/benchmark.js')
const { Attributes, MAXIMUM_CUSTOM_ATTRIBUTES } = require('#agentlib/attributes.js')
const AttributeFilter = require('#agentlib/config/attribute-filter.js')

const DESTINATIONS = AttributeFilter.DESTINATIONS
const TRANSACTION_SCOPE = Attributes.SCOPE_TRANSACTION

// Seed count used by the "realistic usage" benchmark: just under the custom
// attribute maximum so that measurement crosses the 64 limit.
const SEED_COUNT = MAXIMUM_CUSTOM_ATTRIBUTES - 4

// A mix of destination masks so attributes resolve to varying numbers of
// destinations: some multi-destination (TRANS_SCOPE = 4, TRANS_COMMON = 3,
// LIMITED = 2) and some single-destination (TRANS_EVENT). Cycling through
// these while seeding/adding exercises the per-destination filtering paths.
const DESTINATION_MIX = [
  DESTINATIONS.TRANS_SCOPE,
  DESTINATIONS.TRANS_COMMON,
  DESTINATIONS.LIMITED,
  DESTINATIONS.TRANS_EVENT
]

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
  },
  {
    name: 'realistic-usage',
    before: seededInstance,
    fn: realisticUsage
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

// Models the `trace.custom` container: a limited (64-attribute) instance
// pre-seeded with SEED_COUNT existing attributes so the measured work exercises
// the realistic mix of adding new keys (crossing and exceeding the limit) and
// updating existing keys (the overwrite path, which bypasses the limit check).
function seededInstance() {
  const inst = new Attributes({
    scope: TRANSACTION_SCOPE,
    limit: MAXIMUM_CUSTOM_ATTRIBUTES
  })
  for (let i = 0; i < SEED_COUNT; i++) {
    const destinations = DESTINATION_MIX[i % DESTINATION_MIX.length]
    inst.addAttribute(destinations, `seed.${i}`, `value.${i}`)
  }
  return { inst }
}

function realisticUsage(agent, { inst }) {
  // Add new attributes to reach the limit (64) and then exceed it; the last two
  // additions are dropped once the count passes MAXIMUM_CUSTOM_ATTRIBUTES. The
  // destination mix means some of these target multiple destinations.
  for (let i = 0; i < 8; i++) {
    const destinations = DESTINATION_MIX[i % DESTINATION_MIX.length]
    inst.addAttribute(destinations, `added.${i}`, `value.${i}`)
  }

  // Update existing attributes; these hit the overwrite path and are exempt
  // from the limit check because the key already exists.
  for (let i = 0; i < 8; i++) {
    const destinations = DESTINATION_MIX[i % DESTINATION_MIX.length]
    inst.addAttribute(destinations, `seed.${i}`, `updated.${i}`)
  }
}
