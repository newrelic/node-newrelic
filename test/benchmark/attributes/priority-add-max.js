'use strict'

const benchmark = require('../../lib/benchmark')

const {PrioritizedAttributes, ATTRIBUTE_PRIORITY} = require('../../../lib/prioritized-attributes')
const AttributeFilter = require('../../../lib/config/attribute-filter')

const DESTINATIONS = AttributeFilter.DESTINATIONS
const SEGMENT_SCOPE = 'segment'

const testAttributes = new PrioritizedAttributes(SEGMENT_SCOPE, 64)
batchAddAttributes(testAttributes, 64)

const suite = benchmark.createBenchmark({name: 'priority attributes', runs: 100000})

let iterationCount = 0
suite.add({
  name: 'add past maximum',
  fn: function() {
    iterationCount++
    const name = iterationCount.toString()
    testAttributes.addAttribute(
      DESTINATIONS.SPAN_EVENT,
      name,
      iterationCount,
      false,
      ATTRIBUTE_PRIORITY.HIGH
    )
  }
})

suite.run()

function batchAddAttributes(attributes, attributeCount) {
  for (let i = 0; i < attributeCount; i++) {
    const name = `attr: ${i}`
    attributes.addAttribute(DESTINATIONS.SPAN_EVENT, name, i, false, ATTRIBUTE_PRIORITY.HIGH)
  }
}
