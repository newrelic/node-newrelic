/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('#testlib/benchmark.js')

const { PrioritizedAttributes, ATTRIBUTE_PRIORITY } = require('#agentlib/attributes/prioritized.js')
const AttributeFilter = require('#agentlib/config/attribute-filter.js')

const DESTINATIONS = AttributeFilter.DESTINATIONS
const SEGMENT_SCOPE = 'segment'

const highPriorityAttributes = new PrioritizedAttributes(SEGMENT_SCOPE, 64)
batchAddAttributes(highPriorityAttributes, 64, ATTRIBUTE_PRIORITY.HIGH)

const lowPriorityAttributes = new PrioritizedAttributes(SEGMENT_SCOPE, 64)
batchAddAttributes(lowPriorityAttributes, 64, ATTRIBUTE_PRIORITY.LOW)

const halfLowHalfHighPriorityAttributes = new PrioritizedAttributes(SEGMENT_SCOPE, 64)
batchAddAttributes(halfLowHalfHighPriorityAttributes, 32, ATTRIBUTE_PRIORITY.LOW)
batchAddAttributes(halfLowHalfHighPriorityAttributes, 32, ATTRIBUTE_PRIORITY.HIGH)

const suite = benchmark.createBenchmark({ name: 'addAttribute', runs: 100000 })

let iterationCount = 0
suite.add({
  name: 'add past maximum, all high priority to start',
  fn: function () {
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
  fn: function () {
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
  fn: function () {
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

// Models a span's attribute container seeded near capacity with a mix of
// priorities, then exercising the realistic add/overwrite/drop paths.
const SEED_COUNT = 60
const seededMixed = new PrioritizedAttributes(SEGMENT_SCOPE, 64)
for (let i = 0; i < SEED_COUNT; i++) {
  const priority = i % 2 === 0 ? ATTRIBUTE_PRIORITY.HIGH : ATTRIBUTE_PRIORITY.LOW
  seededMixed.addAttribute(DESTINATIONS.SPAN_EVENT, `seed.${i}`, i, false, priority)
}

let realisticCount = 0
suite.add({
  name: 'realistic-usage',
  fn: function () {
    realisticCount++
    // Add a new high-priority attribute; displaces a low-priority seed once at limit.
    seededMixed.addAttribute(
      DESTINATIONS.SPAN_EVENT,
      `new.${realisticCount}`,
      realisticCount,
      false,
      ATTRIBUTE_PRIORITY.HIGH
    )
    // Overwrite an existing seed; bypasses the limit check.
    seededMixed.addAttribute(
      DESTINATIONS.SPAN_EVENT,
      `seed.${realisticCount % SEED_COUNT}`,
      realisticCount,
      false,
      ATTRIBUTE_PRIORITY.HIGH
    )
    // Attempt a low-priority add; will be dropped once capacity is full.
    seededMixed.addAttribute(
      DESTINATIONS.SPAN_EVENT,
      `low.${realisticCount}`,
      realisticCount,
      false,
      ATTRIBUTE_PRIORITY.LOW
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
