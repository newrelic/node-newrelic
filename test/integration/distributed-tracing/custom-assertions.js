/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const { getEventsToCheck, getExactExpectedUnexpectedFromIntrinsics } = require('./helpers')

function getDescendantValue(object, descendants) {
  const arrayDescendants = descendants.split('.')
  const noop = () => { }
  while (arrayDescendants.length && (object = object[arrayDescendants.shift()])) {
    noop()
  }
  return object
}

function hasNestedProperty(object, descendants) {
  const arrayDescendants = descendants.split('.')

  let currentItem = object
  for (let i = 0; i < arrayDescendants.length; i++) {
    const property = arrayDescendants[i]

    if (!currentItem || currentItem[property] == null) {
      return false
    }

    currentItem = currentItem[property]
  }

  return true
}

function exact(object, fixture) {
  for (let [descendants, fixtureValue] of Object.entries(fixture)) {
    if (descendants === 'tracestate.parent_type') {
      // The fixture data has the original source value, an integer, as the
      // value to check for. Our Transaction expects a string value. Instead
      // of mutating the `Tracestate` object after it is created in the test,
      // we re-define the fixture value in-place.
      // eslint-disable-next-line sonarjs/updated-loop-counter
      fixtureValue = 'App'
    }

    const valueToTest = getDescendantValue(object, descendants)
    assert.deepEqual(
      valueToTest,
      fixtureValue,
      `Expected ${descendants} to be ${fixtureValue} but got ${valueToTest}`
    )
  }
}

function expected(object, fixture) {
  for (const fixtureValue of fixture) {
    const exists = hasNestedProperty(object, fixtureValue)
    assert.ok(exists, 'is ' + fixtureValue + ' set?')
  }
}

function unexpected(object, fixture) {
  for (const fixtureValue of fixture) {
    const exists = hasNestedProperty(object, fixtureValue)
    assert.equal(exists, false, 'is ' + fixtureValue + ' absent?')
  }
}

function notEqual(object, fixture) {
  for (const [descendants, fixtureValue] of Object.entries(fixture)) {
    const valueToTest = getDescendantValue(object, descendants)
    assert.ok(valueToTest !== fixtureValue, 'is ' + descendants + ' not equal?')
  }
}

function assertVendors(object, vendors) {
  assert.deepStrictEqual(object.tracestate.vendors ?? [], vendors, 'do vendors match?')
}

function expectedFixtureKeys(thingWithKeys, expectedKeys) {
  let actualKeys = thingWithKeys
  if (!Array.isArray(actualKeys)) {
    actualKeys = Object.keys(thingWithKeys)
  }
  for (const key of actualKeys) {
    assert.ok(expectedKeys.indexOf(key) !== -1, 'key [' + key + '] should be expected?')
  }
}

function assertSingleEvent(event, eventType, fixture) {
  const { exact, expected, unexpected } = fixture
  const attributes = event[0]

  assert.ok(attributes, 'Should have attributes')
  const attributesHasOwnProperty = Object.hasOwnProperty.bind(attributes)

  for (const key of expected) {
    const hasAttribute = attributesHasOwnProperty(key)
    assert.ok(hasAttribute, `does ${eventType} have ${key}`)
  }

  for (const key of unexpected) {
    const hasAttribute = attributesHasOwnProperty(key)

    assert.equal(hasAttribute, false, `${eventType} should not have ${key}`)
  }

  for (const key of Object.keys(exact)) {
    const attributeValue = attributes[key]
    const expectedValue = exact[key]

    assert.equal(attributeValue, expectedValue, `${eventType} should have ${key}=${expectedValue}`)
  }
}

function assertOutboundPayloads(testCase, context) {
  if (!testCase.outbound_payloads) {
    return
  }
  for (const [key, testToRun] of Object.entries(testCase.outbound_payloads)) {
    for (const [assertType, fields] of Object.entries(testToRun)) {
      switch (assertType) {
        case 'exact':
          exact(context[key], fields)
          break
        case 'expected':
          expected(context[key], fields)
          break
        case 'unexpected':
          unexpected(context[key], fields)
          break
        case 'notequal':
          notEqual(context[key], fields)
          break
        case 'vendors':
          assertVendors(context[key], fields)
          break
        default:
          throw new Error("I don't know how to test a(n) " + assertType)
      }
    }
  }
}

function assertMetrics(testCase, agent) {
  if (!testCase.expected_metrics) {
    return
  }
  const metrics = agent.metrics
  for (const metricPair of Object.values(testCase.expected_metrics)) {
    const metricName = metricPair[0]
    const callCount = metrics.getOrCreateMetric(metricName).callCount
    const metricCount = metricPair[1]
    assert.ok(callCount === metricCount, `${metricName} should have ${metricCount} samples`)
  }
}

function assertEvents(testCase, agent) {
  if (!testCase.intrinsics) {
    return
  }
  for (const eventType of Object.values(testCase.intrinsics.target_events)) {
    const toCheck = getEventsToCheck(eventType, agent)
    assert.ok(toCheck.length > 0, 'do we have an event ( ' + eventType + ' ) to test?')
    const fixture = getExactExpectedUnexpectedFromIntrinsics(testCase, eventType)

    for (const event of toCheck) {
      // Span events are not payload-formatted
      // straight out of the aggregator.
      const finalEvent = eventType === 'Span' ? event.toJSON() : event
      assertSingleEvent(finalEvent, eventType, fixture)
    }
  }
}

module.exports = {
  assertEvents,
  assertMetrics,
  assertOutboundPayloads,
  exact,
  expected,
  expectedFixtureKeys,
  notEqual,
  unexpected
}
