/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { TYPES } = require('../../../lib/transaction')
const API = require('../../../api')
const helper = require('../../lib/agent_helper')
const recorder = require('../../../lib/metrics/recorders/distributed-trace')
const recordSupportability = require('../../../lib/agent').prototype.recordSupportability

const camelCaseToSnakeCase = function (object) {
  const newObject = {}
  for (const [key, value] of Object.entries(object)) {
    const newKey = key.replace(/[A-Z]/g, ' $&').replace(' ', '_').toLowerCase()
    newObject[newKey] = value
  }
  return newObject
}

const getDescendantValue = function (object, descendants) {
  const arrayDescendants = descendants.split('.')
  const noop = () => {}
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

    if (!currentItem || !Object.prototype.hasOwnProperty.call(currentItem, property)) {
      return false
    }

    currentItem = currentItem[property]
  }

  return true
}

const testExact = function (object, fixture) {
  for (const [descendants, fixtureValue] of Object.entries(fixture)) {
    const valueToTest = getDescendantValue(object, descendants)
    assert.deepEqual(
      valueToTest,
      fixtureValue,
      `Expected ${descendants} to be ${fixtureValue} but got ${valueToTest}`
    )
  }
}

const testExpected = function (object, fixture) {
  for (const [key] of fixture.entries()) {
    const fixtureValue = fixture[key]

    const exists = hasNestedProperty(object, fixtureValue)
    assert.ok(exists, 'is ' + fixtureValue + ' set?')
  }
}

const testUnexpected = function (object, fixture) {
  for (const [key] of fixture.entries()) {
    const fixtureValue = fixture[key]

    const exists = hasNestedProperty(object, fixtureValue)
    assert.equal(exists, false, 'is ' + fixtureValue + ' absent?')
  }
}

const testNotEqual = function (object, fixture) {
  for (const [descendants, fixtureValue] of Object.entries(fixture)) {
    const valueToTest = getDescendantValue(object, descendants)
    assert.ok(valueToTest !== fixtureValue, 'is ' + descendants + ' not equal?')
  }
}

const testVendor = function (object, vendors) {
  assert.deepStrictEqual(object.tracestate.vendors, vendors, 'do vendors match?')
}

// Tests a few of the helper functions we wrote for this test suite.
test('helper functions', () => {
  const objectExact = {
    foo: { bar: 'baz' },
    one: { two: 'three' }
  }
  testExact(objectExact, { 'foo.bar': 'baz', 'one.two': 'three' })

  const objectExpected = {
    foo: { bar: 'baz' },
    one: { two: 'three' },
    science: false,
    science2: NaN
  }
  testExpected(objectExpected, ['foo.bar', 'one.two', 'science', 'science2'])

  const objectUnExpected = {
    foo: { bar: 'baz' },
    one: { two: 'three' },
    science: false,
    science2: NaN
  }
  testUnexpected(objectUnExpected, ['apple', 'orange'])

  const objectNotEqual = {
    foo: { bar: 'baz' },
    one: { two: 'three' }
  }
  testNotEqual(objectNotEqual, { 'foo.bar': 'bazz', 'one.two': 'threee' })
})

test('distributed tracing trace context', async (t) => {
  const testCases = require('../../lib/cross_agent_tests/distributed_tracing/trace_context.json')
  for (const testCase of testCases) {
    await runTestCase(testCase, t)
  }
})

function getEventsToCheck(eventType, agent) {
  let toCheck
  switch (eventType) {
    case 'Transaction':
      toCheck = agent.transactionEventAggregator.getEvents()
      break
    case 'TransactionError':
      toCheck = agent.errors.eventAggregator.getEvents()
      break
    case 'Span':
      toCheck = agent.spanEventAggregator.getEvents()
      break
    default:
      throw new Error('I do no know how to test an ' + eventType)
  }
  return toCheck
}

function getExactExpectedUnexpectedFromIntrinsics(testCase, eventType) {
  const common = testCase.intrinsics.common
  const specific = testCase.intrinsics[eventType] || {}
  const exact = Object.assign(specific.exact || {}, common.exact || {})
  const expected = (specific.expected || []).concat(common.expected || [])
  const unexpected = (specific.unexpected || []).concat(common.unexpected || [])

  return {
    exact,
    expected,
    unexpected
  }
}

function testSingleEvent(event, eventType, fixture) {
  const { exact, expected, unexpected } = fixture
  const attributes = event[0]

  assert.ok(attributes, 'Should have attributes')
  const attributesHasOwnProperty = Object.hasOwnProperty.bind(attributes)

  expected.forEach((key) => {
    const hasAttribute = attributesHasOwnProperty(key)
    assert.ok(hasAttribute, `does ${eventType} have ${key}`)
  })

  unexpected.forEach((key) => {
    const hasAttribute = attributesHasOwnProperty(key)

    assert.equal(hasAttribute, false, `${eventType} should not have ${key}`)
  })

  Object.keys(exact).forEach((key) => {
    const attributeValue = attributes[key]
    const expectedValue = exact[key]

    assert.equal(attributeValue, expectedValue, `${eventType} should have ${key}=${expectedValue}`)
  })
}

const testExpectedFixtureKeys = function (thingWithKeys, expectedKeys) {
  let actualKeys = thingWithKeys
  if (!Array.isArray(actualKeys)) {
    actualKeys = Object.keys(thingWithKeys)
  }
  for (const key of actualKeys) {
    assert.ok(expectedKeys.indexOf(key) !== -1, 'key [' + key + '] should be expected?')
  }
}

function runTestCaseOutboundPayloads(testCase, context) {
  if (!testCase.outbound_payloads) {
    return
  }
  for (const [key] of testCase.outbound_payloads.entries()) {
    const testToRun = testCase.outbound_payloads[key]
    for (const [assertType, fields] of Object.entries(testToRun)) {
      switch (assertType) {
        case 'exact':
          testExact(context[key], fields)
          break
        case 'expected':
          testExpected(context[key], fields)
          break
        case 'unexpected':
          testUnexpected(context[key], fields)
          break
        case 'notequal':
          testNotEqual(context[key], fields)
          break
        case 'vendors':
          testVendor(context[key], fields)
          break
        default:
          throw new Error("I don't know how to test a(n) " + assertType)
      }
    }
  }
}

function runTestCaseMetrics(testCase, agent) {
  if (!testCase.expected_metrics) {
    return
  }
  const metrics = agent.metrics
  for (const [key] of testCase.expected_metrics.entries()) {
    const metricPair = testCase.expected_metrics[key]
    const metricName = metricPair[0]
    const callCount = metrics.getOrCreateMetric(metricName).callCount
    const metricCount = metricPair[1]
    assert.ok(callCount === metricCount, `${metricName} should have ${metricCount} samples`)
  }
}

function runTestCaseTargetEvents(testCase, agent) {
  if (!testCase.intrinsics) {
    return
  }
  for (const [key] of testCase.intrinsics.target_events.entries()) {
    const eventType = testCase.intrinsics.target_events[key]
    const toCheck = getEventsToCheck(eventType, agent)
    assert.ok(toCheck.length > 0, 'do we have an event ( ' + eventType + ' ) to test?')
    const fixture = getExactExpectedUnexpectedFromIntrinsics(testCase, eventType)

    for (const [index] of toCheck.entries()) {
      // Span events are not payload-formatted
      // straight out of the aggregator.
      const event = eventType === 'Span' ? toCheck[index].toJSON() : toCheck[index]
      testSingleEvent(event, eventType, fixture)
    }
  }
}

async function runTestCase(testCase, parentTest) {
  // validates the test case data has what we're looking for.  Good for
  // catching any changes to the test format over time, as well as becoming
  // familiar with what we need to do to implement a test runner
  await parentTest.test('validate test: ' + testCase.test_name, (t, end) => {
    testExpectedFixtureKeys(testCase, [
      'account_id',
      'expected_metrics',
      'force_sampled_true',
      'inbound_headers',
      'intrinsics',
      'outbound_payloads',
      'raises_exception',
      'span_events_enabled',
      'test_name',
      'transport_type',
      'trusted_account_key',
      'web_transaction',
      'comment',
      'transaction_events_enabled'
    ])

    if (testCase.outbound_payloads) {
      for (const outboundPayload of testCase.outbound_payloads) {
        testExpectedFixtureKeys(outboundPayload, [
          'exact',
          'expected',
          'notequal',
          'vendors',
          'unexpected'
        ])
      }
    }

    if (testCase.intrinsics) {
      // top level intrinsics keys
      testExpectedFixtureKeys(testCase.intrinsics, [
        'Transaction',
        'Span',
        'common',
        'target_events',
        'TransactionError'
      ])

      testExpectedFixtureKeys(testCase.intrinsics.common, ['exact', 'unexpected', 'expected'])

      // test there are no unexpected event types in there
      const expectedEvents = ['Span', 'Transaction', 'TransactionError']
      testExpectedFixtureKeys(testCase.intrinsics.target_events, expectedEvents)

      // test the top level keys of each event
      for (const event of testCase.intrinsics.target_events) {
        const eventTestConfig = testCase.intrinsics[event]

        // a few tests list an expected event, but no data for that event
        if (!eventTestConfig) {
          continue
        }
        testExpectedFixtureKeys(eventTestConfig, ['exact', 'unexpected', 'expected'])
      }
    }
    end()
  })

  await parentTest.test('trace context: ' + testCase.test_name, (t, end) => {
    const agent = helper.instrumentMockedAgent({})
    agent.recordSupportability = recordSupportability
    agent.config.trusted_account_key = testCase.trusted_account_key
    agent.config.account_id = testCase.account_id
    agent.config.primary_application_id = 4657
    agent.config.span_events.enabled = testCase.span_events_enabled
    agent.config.transaction_events.enabled = testCase.transaction_events_enabled
    agent.config.distributed_tracing.enabled = true
    t.after(() => helper.unloadAgent(agent))

    const agentApi = new API(agent)

    const transactionType = testCase.web_transaction ? TYPES.WEB : TYPES.BG

    helper.runInTransaction(agent, transactionType, function (transaction) {
      transaction.baseSegment = transaction.trace.add('MyBaseSegment', (segment) => {
        recorder(
          transaction,
          testCase.web_transaction ? 'Web' : 'Other',
          segment.getDurationInMillis(),
          segment.getExclusiveDurationInMillis()
        )
      })

      // Check to see if the test runner should throw an error
      if (testCase.raises_exception) {
        agentApi.noticeError(new Error('should error'))
      }

      // monkey patch this transaction object
      // to force sampled to be true.
      if (testCase.force_sampled_true) {
        transaction.agent.transactionSampler.shouldSample = function stubShouldSample() {
          return true
        }
      }

      for (const inboundHeader of testCase.inbound_headers.values()) {
        transaction.acceptDistributedTraceHeaders(testCase.transport_type, inboundHeader)

        // Generate outbound payloads
        const outboundTraceContextPayloads = testCase.outbound_payloads || []

        const insertCount = Math.max(outboundTraceContextPayloads.length)

        const outboundHeaders = []
        for (let i = 0; i < insertCount; i++) {
          const headers = {}
          transaction.insertDistributedTraceHeaders(headers)
          outboundHeaders.push(headers)
        }

        const insertedTraceContextTraces = outboundHeaders.map((headers) => {
          // Find the first/leftmost list-member, parse out intrinsics and tenant id
          const listMembers = headers.tracestate.split(',')
          const nrTraceState = listMembers.splice(0, 1)[0] // removes the NR tracestate
          const [tenantString, nrTracestateEntry] = nrTraceState.split('=')
          const tenantId = tenantString.split('@')[0]
          const intrinsics = transaction.traceContext._parseIntrinsics(nrTracestateEntry)

          // _parseIntrinsics returns null for absent items, remove them
          Object.keys(intrinsics).forEach((k) => {
            if (intrinsics[k] === null) {
              delete intrinsics[k]
            }
          })

          // Get a list of vendor strings from the tracestate after removing the
          // NR list-member
          const vendors = listMembers.map((m) => m.split('=')[0])

          // Found entry for the correct trust key / tenantId
          // So manually setting for now
          intrinsics.tenantId = tenantId
          intrinsics.vendors = vendors

          // get payload for how we represent it internally to how tests want it
          const outboundPayload = {
            traceparent: transaction.traceContext._validateAndParseTraceParentHeader(
              headers.traceparent
            ),
            tracestate: intrinsics
          }

          const normalizeAgentDataToCrossAgentTestData = function (data) {
            data = camelCaseToSnakeCase(data)
            if (data.flags) {
              data.trace_flags = data.flags
              delete data.flags
            }

            data.parent_account_id = data.account_id
            delete data.account_id

            data.parent_application_id = data.app_id
            delete data.app_id

            if (data.sampled) {
              data.sampled = data.sampled ? true : false
            }

            return data
          }

          outboundPayload.tracestate = normalizeAgentDataToCrossAgentTestData(
            outboundPayload.tracestate
          )
          outboundPayload.traceparent = normalizeAgentDataToCrossAgentTestData(
            outboundPayload.traceparent
          )

          if (headers.newrelic) {
            const rawPayload = Buffer.from(headers.newrelic, 'base64').toString('utf-8')
            outboundPayload.newrelic = JSON.parse(rawPayload)
          }

          return outboundPayload
        })

        // end transaction
        transaction.trace.root.touch()
        transaction.end()

        // These tests assume setting a transport type even when there are not valid
        // trace headers. This is slightly inconsistent with the spec. Given DT
        // (NR format) does not include transport when there is no trace AND the
        // attribute parent.transportType is only populated when a valid payload recieved,
        // we are keeping our implementation conistent for now.
        const removeTransportTests = [
          'missing_traceparent',
          'missing_traceparent_and_tracestate',
          'w3c_and_newrelic_headers_present_error_parsing_traceparent'
        ]
        if (removeTransportTests.indexOf(testCase.test_name) >= 0) {
          testCase.expected_metrics = testCase.expected_metrics.map((value) => {
            if (value[0].indexOf('HTTP/all') >= 0) {
              value[0] = 'DurationByCaller/Unknown/Unknown/Unknown/Unknown/all'
            } else if (value.indexOf('HTTP/allWeb') >= 0) {
              value[0] = 'DurationByCaller/Unknown/Unknown/Unknown/Unknown/allWeb'
            }

            return value
          })
        }

        // Priority is asserted to have 1-less precision than the incoming, which is not an agent
        // requirement and not something we do. Adjusting so we can have the test in the repository.
        if (testCase.test_name === 'newrelic_origin_trace_id_correctly_transformed_for_w3c') {
          const payloadTest = testCase.outbound_payloads[0]
          payloadTest.exact['newrelic.d.pr'] = 1.1234321
        }

        runTestCaseOutboundPayloads(testCase, insertedTraceContextTraces)
        runTestCaseTargetEvents(testCase, agent)
        runTestCaseMetrics(testCase, agent)
      }

      assert.ok(transaction, 'we have a transaction')
    })

    end()
  })
}
