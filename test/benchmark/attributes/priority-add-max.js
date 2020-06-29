/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('../../lib/benchmark')

const {PrioritizedAttributes, ATTRIBUTE_PRIORITY} = require('../../../lib/prioritized-attributes')
const AttributeFilter = require('../../../lib/config/attribute-filter')

const DESTINATIONS = AttributeFilter.DESTINATIONS
const SEGMENT_SCOPE = 'segment'

const highPriorityAttributes = new PrioritizedAttributes(SEGMENT_SCOPE, 64)
batchAddAttributes(highPriorityAttributes, 64, ATTRIBUTE_PRIORITY.HIGH)

const lowPriorityAttributes = new PrioritizedAttributes(SEGMENT_SCOPE, 64)
batchAddAttributes(lowPriorityAttributes, 64, ATTRIBUTE_PRIORITY.LOW)

const halfLowHalfHighPriorityAttributes = new PrioritizedAttributes(SEGMENT_SCOPE, 64)
batchAddAttributes(halfLowHalfHighPriorityAttributes, 32, ATTRIBUTE_PRIORITY.LOW)
batchAddAttributes(halfLowHalfHighPriorityAttributes, 32, ATTRIBUTE_PRIORITY.HIGH)

const suite = benchmark.createBenchmark({name: 'priority attributes', runs: 100000})

let iterationCount = 0
suite.add({
  name: 'add past maximum, all high priority to start',
  fn: function() {
    iterationCount++
    const name = iterationCount.toString()
    highPriorityAttributes.addAttribute(
      DESTINATIONS.SPAN_EVENT,
      name,
      iterationCount,
      false,
      ATTRIBUTE_PRIORITY.HIGH
    )
  }
})

suite.add({
  name: 'add past maximum, all low priority to start',
  fn: function() {
    iterationCount++
    const name = iterationCount.toString()
    lowPriorityAttributes.addAttribute(
      DESTINATIONS.SPAN_EVENT,
      name,
      iterationCount,
      false,
      ATTRIBUTE_PRIORITY.HIGH
    )
  }
})

suite.add({
  name: 'add past maximum, first half low and last half high to start',
  fn: function() {
    iterationCount++
    const name = iterationCount.toString()
    lowPriorityAttributes.addAttribute(
      DESTINATIONS.SPAN_EVENT,
      name,
      iterationCount,
      false,
      ATTRIBUTE_PRIORITY.HIGH
    )
  }
})

suite.run()

function batchAddAttributes(attributes, attributeCount, priority) {
  for (let i = 0; i < attributeCount; i++) {
    const name = `attr: ${i}`
    attributes.addAttribute(DESTINATIONS.SPAN_EVENT, name, i, false, priority)
  }
}
