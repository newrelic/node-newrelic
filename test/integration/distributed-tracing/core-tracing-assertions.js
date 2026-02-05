/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')

/**
 * Asserts the expected metrics for a given test
 *
 * @param {object} params to function
 * @param {Agent} params.agent agent instance
 * @param {Array} params.expectedMetrics expected metrics multi-dimensional array
 */
function assertMetrics({ agent, expectedMetrics = [] }) {
  for (const metric of expectedMetrics) {
    // test case has Java in names, replace with Nodejs
    const name = metric[0].replace('Java', 'Nodejs')
    const expectedValue = metric[1]
    const value = agent.metrics._metrics.unscoped[name].callCount
    assert.equal(value, expectedValue, `metric ${name} should be ${expectedValue}, got ${value}`)
  }
}

/**
 * Asserts that a span does not exist aka dropped
 *
 * @param {object} params to function
 * @param {Array} params.spans spans created during transaction
 * @param {Array} params.droppedSpans list of dropped spans
 */
function assertDroppedSpans({ spans, droppedSpans = [] }) {
  for (const span of droppedSpans) {
    assert.ok(!findSpan({ name: span, spans }), `${span} should have been dropped`)
  }
}

/**
 * Asserts that a span exits, its parent id is correct,
 * and all agent, intrinsics and custom attributes were created
 *
 * @param {object} params to function
 * @param {Array} params.spans spans created during transaction
 * @param {Array} params.expectedSpans collection of spans that were retained
 */
function assertSpanTree({ spans, expectedSpans = [] }) {
  for (const expectedSpan of expectedSpans) {
    for (const [name, values] of Object.entries(expectedSpan)) {
      const span = findSpan({ spans, name })
      assert.ok(span, `should have created span: ${name}`)
      assertParentId({ span, spans, parent: values.parent })
      assertAttrs({ span, attrs: values.agent_attrs, type: 'attributes' })
      assertAttrs({ span, attrs: values.user_attrs, type: 'customAttributes' })
      assertAttrs({ span, attrs: values.intrinsics, type: 'intrinsics' })
    }
  }
}

/**
 * Attempts to find a span in the collection of spans
 *
 * @param {object} params to function
 * @param {Array} params.spans spans created during transaction
 * @param {string} params.name name of span to find
 * @returns {Span|null} returns span if it exists
 */
function findSpan({ spans, name }) {
  return spans.find((span) => span.intrinsics.name === name)
}

/**
 * Asserts the parent id is correct for a given span
 *
 * @param {object} params to function
 * @param {Array} params.spans spans created during transaction
 * @param {string|null} params.parent name of parent span
 * @param {Span} params.span span to check its parent
 */
function assertParentId({ parent, spans, span }) {
  if (parent) {
    const parentSpan = findSpan({ spans, name: parent })
    assert.equal(span.parentId, parentSpan.id, `span ${span.intrinsics.name} should have parent ${parent}, got ${parentSpan.intrinsics.name}`)
  } else {
    assert.equal(span.parentId, parent)
  }
}

/**
 *  Asserts that an attribute is equal, exists or does not exist
 *
 * @param {object} params to function
 * @param {Span} params.span span to check its attributes
 * @param {object} params.attrs fixture to check the relevant attributes
 * @param {string} params.type type of attributes to check against
 */
function assertAttrs({ span, attrs = {}, type }) {
  const { exact = {}, unexpected = [], expected = [] } = attrs

  for (const key of expected) {
    assert.ok(Object.prototype.hasOwnProperty.call(span[type], key), `${key} ${type} should exist on ${span.intrinsics.name}`)
  }
  for (const key of unexpected) {
    assert.ok(!Object.prototype.hasOwnProperty.call(span[type], key), `${key} ${type} should not exist on ${span.intrinsics.name}`)
  }

  for (const [key, value] of Object.entries(exact)) {
    if (key === 'nr.durations') {
      // numbers are fun in javascript, have to fix the values to 2 digits
      const fixedValue = span[type][key].toFixed(2)
      const expectedFixedValue = value.toFixed(2)
      assert.equal(fixedValue, expectedFixedValue, `${key} ${type} should be ${expectedFixedValue}, got ${fixedValue}`)
    } else {
      assert.equal(span[type][key], value, `${key} ${type} should be ${value}, got ${span.attributes[key]}`)
    }
  }
}

module.exports = {
  assertMetrics,
  assertDroppedSpans,
  assertSpanTree
}
