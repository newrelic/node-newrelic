'use strict'
const tap = require('tap')
const helper = require('../../lib/agent_helper')
const TYPES = require('../../../lib/transaction').TYPES
const recorder = require('../../../lib/metrics/recorders/distributed-trace')

/* lists of tests to skip so we can skip tests
   until progress is made/things are finalized */
const skipTests = [
  "accept_payload",
  "background_transaction",
  "create_payload",
  "exception",
  "lowercase_known_transport_is_unknown",
  "missing_traceparent_and_tracestate",
  "missing_traceparent",
  "missing_tracestate",
  "multiple_create_calls",
  "multiple_new_relic_trace_state_entries",
  "multiple_vendors_in_tracestate",
  "payload_from_mobile_caller",
  "payload_from_trusted_partnership_account",
  "payload_from_untrusted_account",
  "payload_with_sampled_false",
  "payload_with_untrusted_key",
  "spans_disabled_in_child",
  "spans_disabled_in_parent",
  "spans_disabled_root",
  "traceparent_missing_traceId",
  "tracestate_has_larger_version",
  "tracestate_missing_account",
  "tracestate_missing_application",
  "tracestate_missing_timestamp",
  "tracestate_missing_transactionId",
  "tracestate_missing_type",
  "tracestate_missing_version",
  "w3c_and_newrelc_headers_present",
  "w3c_and_newrelc_headers_present_error_parsing_traceparent",
  "w3c_and_newrelc_headers_present_error_parsing_tracestate",
  "trace_id_is_left_padded_and_priority_rounded"
]

const camelCaseToSnakeCase = function(object) {
  const newObject = {}
  for (const [key, value] of Object.entries(object)) {
    const newKey = key.replace(/[A-Z]/g, ' $&')
      .replace(' ', '_').toLowerCase()
    newObject[newKey] = value
  }
  return newObject
}

const getDescendantValue = function(object, descendants) {
  const arrayDescendants = descendants.split('.')
  while (arrayDescendants.length && (object = object[arrayDescendants.shift()]));
  return object
}

const testExpectedFixtureKeys = function(t, thingWithKeys, expectedKeys) {
  let actualKeys = thingWithKeys
  if (!Array.isArray(actualKeys)) {
    actualKeys = Object.keys(thingWithKeys)
  }
  for (const [i] of actualKeys.entries()) {
    const key = actualKeys[i]
    t.ok(expectedKeys.indexOf(key) !== -1, 'key [' + key + '] should be expected?')
  }
}

const testExact = function(t, object, fixture) {
  for (const [descendants, fixtureValue] of Object.entries(fixture)) {
    const valueToTest = getDescendantValue(object, descendants)
    t.ok(valueToTest === fixtureValue, 'is ' + descendants + ' an exact match?')
  }
}

const testNotEqual = function(t, object, fixture) {
  for (const [descendants, fixtureValue] of Object.entries(fixture)) {
    const valueToTest = getDescendantValue(object, descendants)
    t.ok(valueToTest !== fixtureValue, 'is ' + descendants + ' not equal?')
  }
}

const testUnexpected = function(t, object, fixture) {
  for (const [key] of fixture.entries()) {
    const fixtureValue = fixture[key]
    t.ok(
      typeof (getDescendantValue(object, fixtureValue)) === 'undefined',
      'is ' + fixtureValue + ' absent?'
    )
  }
}

const testExpected = function(t, object, fixture) {
  for (const [key] of fixture.entries()) {
    const fixtureValue = fixture[key]
    t.ok(
      typeof (getDescendantValue(object, fixtureValue)) !== 'undefined',
      'is ' + fixtureValue + ' set?'
    )
  }
}

const testVendor = function(t, object, vendors) {
  t.deepEquals(object.tracestate.vendors, vendors, 'do vendors match?')
}

// tests a few of the helper functions we wrote for this test case
tap.test('helper functions', function(t) {
  const objectExact = {
    'foo':{'bar':'baz'},
    'one':{'two':'three'}
  }
  testExact(t, objectExact, {'foo.bar':'baz','one.two':'three'})

  const objectExpected = {
    'foo':{'bar':'baz'},
    'one':{'two':'three'},
    'science': false,
    'science2': NaN,
  }
  testExpected(t, objectExpected, ['foo.bar', 'one.two', 'science','science2'])

  const objectUnExpected = {
    'foo':{'bar':'baz'},
    'one':{'two':'three'},
    'science': false,
    'science2': NaN,
  }
  testUnexpected(t, objectUnExpected, ['apple','orange'])

  const objectNotEqual = {
    'foo':{'bar':'baz'},
    'one':{'two':'three'}
  }
  testNotEqual(t, objectNotEqual, {'foo.bar':'bazz','one.two':'threee'})
  t.end()
})

const getEventsToCheck = function(eventType, agent) {
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

const getExactExpectedUnexpectedFromIntrinsics = function(testCase, eventType) {
  const common = testCase.intrinsics.common
  const specific = testCase.intrinsics[eventType] || {}
  const exact = Object.assign(
    specific.exact || {},
    common.exact || {}
  )
  const expected = (specific.expected || []).concat(common.expected || [])
  const unexpected =
    (specific.unexpected || []).concat(common.unexpected || [])

  return {
    'exact':exact,
    'expected':expected,
    'unexpected':unexpected
  }
}

const testSingleEvent = function(t, event, eventType, fixture) {
  const {exact, expected, unexpected} = fixture
  const attributes = event[0]

  t.ok(attributes, 'Should have attributes')
  const attributesHasOwnProperty = Object.hasOwnProperty.bind(attributes)

  expected.forEach((key) => {
    const hasAttribute = attributesHasOwnProperty(key)
    t.ok(
      hasAttribute,
      `does ${eventType} have ${key}`
    )
  })

  unexpected.forEach((key) => {
    const hasAttribute = attributesHasOwnProperty(key)

    t.notOk(
      hasAttribute,
      `${eventType} should not have ${key}`
    )
  })


  Object.keys(exact).forEach((key) => {
    const attributeValue = attributes[key]
    const expectedValue = exact[key]

    t.equals(
      attributeValue,
      expectedValue,
      `${eventType} should have ${key}=${expectedValue}`
    )
  })
}

const runTestCaseTargetEvents = function(t, testCase, agent) {
  if (!testCase.intrinsics) { return }
  for (const [key] of testCase.intrinsics.target_events.entries()) {
    const eventType = testCase.intrinsics.target_events[key]
    const toCheck = getEventsToCheck(eventType, agent)
    t.ok(toCheck.length > 0, 'do we have an event ( ' + eventType + ' ) to test?')
    const fixture = getExactExpectedUnexpectedFromIntrinsics(testCase, eventType)

    for (const [index] of toCheck.entries()) {
      // Span events are not payload-formatted
      // straight out of the aggregator.
      const event = ('Span' === eventType) ? toCheck[index].toJSON() : toCheck[index]
      testSingleEvent(t, event, eventType, fixture)
    }
  }
}

const runTestCaseMetrics = function(t, testCase, agent) {
  if (!testCase.expected_metrics) { return }
  const metrics = agent.metrics
  for (const [key] of testCase.expected_metrics.entries()) {
    const metricPair = testCase.expected_metrics[key]
    const metricName = metricPair[0]
    const callCount = metrics.getOrCreateMetric(metricName).callCount
    const metricCount = metricPair[1]
    t.ok(callCount === metricCount, `${metricName} should have ${metricCount} samples`)
  }
}


const runTestCaseOutboundPayloads = function(t, testCase, context) {
  if (!testCase.outbound_payloads) { return }
  for (const [key] of testCase.outbound_payloads.entries()) {
    const testToRun = testCase.outbound_payloads[key]
    for (const [assertType,fields] of Object.entries(testToRun)) {
      switch (assertType) {
        case 'exact':
          testExact(t, context, fields)
          break
        case 'expected':
          testExpected(t, context, fields)
          break
        case 'unexpected':
          testUnexpected(t, context, fields)
        case 'notequal':
          testNotEqual(t, context, fields)
          break
        case 'vendors':
          testVendor(t, context, fields)
          break
        default:
          throw new Error("I don't know how to test a(n) " + assertType)
      }
    }
  }
}

const runTestCase = function(testCase, parentTest) {
  // temp -- we can't run inbound header tests until we have
  // something like go's `AcceptDistributedTraceHeaders` method,
  // which accepts _all three_ headers.  Until then, we'll auto
  // fail any test that has `newrelic` in its inbound headers
  for (const [key] of testCase.inbound_headers.entries()) {
    const header = testCase.inbound_headers[key]
    if (header.newrelic) {
      parentTest.fail(
        `I don't know how to test a traditional DT/BetterCat newrelic header`
      )
    }
  }

  // validates the test case data has what we're looking for.  Good for
  // catching any changes to the test format over time, as well as becoming
  // familiar with what we need to do to implement a test runner
  parentTest.test('validate test: ' + testCase.test_name, function(t) {
    testExpectedFixtureKeys(
      t,
      testCase,
      [ 'account_id', 'expected_metrics', 'force_sampled_true',
        'inbound_headers', 'intrinsics', 'outbound_payloads',
        'raises_exception', 'span_events_enabled', 'test_name',
        'transport_type','trusted_account_key', 'web_transaction','comment'
      ]
    )

    if (testCase.outbound_payloads) {
      for (const [i] of testCase.outbound_payloads.entries()) {
        const outboundPayload = testCase.outbound_payloads[i]
        testExpectedFixtureKeys(
          t,
          outboundPayload,
          ['exact','expected', 'notequal', 'vendors','unexpected']
        )
      }
    }

    if (testCase.intrinsics) {
      // top level intrinsics keys
      testExpectedFixtureKeys(
        t,
        testCase.intrinsics,
        ['Transaction','Span','common','target_events','TransactionError']
      )

      testExpectedFixtureKeys(
        t,
        testCase.intrinsics.common,
        ['exact','unexpected','expected']
      )

      // test there are no unexpected event types in there
      const expectedEvents = ['Span','Transaction','TransactionError']
      testExpectedFixtureKeys(
        t,
        testCase.intrinsics.target_events,
        expectedEvents
      )

      // test the top level keys of each event
      for (const [i] of testCase.intrinsics.target_events.entries()) {
        const event = testCase.intrinsics.target_events[i]
        const eventTestConfig = testCase.intrinsics[event]

        // a few tests list an expected event, but no data for that event
        if (!eventTestConfig) {
          continue
        }
        testExpectedFixtureKeys(
          t,
          eventTestConfig,
          ['exact','unexpected','expected']
        )
      }
    }
    t.end()
  })

  parentTest.test('trace context: ' + testCase.test_name, function(t) {
    const agent = helper.instrumentMockedAgent({})
    agent.config.trusted_account_key = testCase.trusted_account_key
    agent.config.account_id = testCase.account_id
    agent.config.primary_application_id = 4657
    agent.config.span_events.enabled = testCase.span_events_enabled
    agent.config.distributed_tracing.enabled = true
    agent.config.feature_flag.dt_format_w3c = true
    const transactionType = testCase.web_transaction ?
      TYPES.WEB : TYPES.BG

    helper.runInTransaction(agent, transactionType, function(transaction) {
      transaction.baseSegment = transaction.trace.root.add('MyBaseSegment', (segment) => {
        recorder(
          transaction,
          testCase.web_transaction ? 'Web' : 'Other',
          segment.getDurationInMillis(),
          segment.getExclusiveDurationInMillis()
        )
      })

      // monkey patch this transaction object
      // to force sampled to be true.
      if (testCase.force_sampled_true) {
        // grab original function
        const originalIsSampled = transaction.isSampled.bind(transaction)

        // monkey batch, binding transaction to `this` works
        // the way we'd expect here
        transaction.isSampled = (function() {
          // call original function to preserve unintentional side effects
          originalIsSampled()

          // forced sampled to be true
          return true
        }).bind(transaction)
      }
      for (const [key] of testCase.inbound_headers.entries()) {
        const inbound_header = testCase.inbound_headers[key]
        transaction.traceContext.acceptTraceContextPayload(
          inbound_header.traceparent,
          inbound_header.tracestate,
          testCase.transport_type
        )

        // generate payload
        const headers = transaction.traceContext.createTraceContextPayload()

        // get payload for how we represent it internally to how tests want it
        const context = {
          'traceparent':
            transaction.traceContext._validateTraceParentHeader(
              headers.traceparent
            ),
          'tracestate':
            transaction.traceContext._validateTraceStateHeader(
              headers.tracestate
            ).intrinsics
        }

        const normalizeAgentDataToCrossAgentTestData = function(data) {
          data = camelCaseToSnakeCase(data)
          if (data.flags) {
            data.trace_flags = data.flags
            delete data.flags
          }

          if (data.sampled) {
            data.sampled = data.sampled ? true : false
          }

          return data
        }
        context.tracestate = normalizeAgentDataToCrossAgentTestData(
          context.tracestate
        )
        context.traceparent = normalizeAgentDataToCrossAgentTestData(
          context.traceparent
        )

        // end transaction
        transaction.trace.root.touch()
        transaction.end()

        // console.log(context)
        runTestCaseOutboundPayloads(t, testCase, context)
        runTestCaseTargetEvents(t, testCase, agent)
        runTestCaseMetrics(t, testCase, agent)
      }

      t.ok(transaction, 'we have a transaction')
    })

    t.end()
    helper.unloadAgent(agent)
  })
}

tap.test('distributed tracing trace context', (t) => {
  const testCases = require(
    '../../lib/cross_agent_tests/distributed_tracing/trace_context.json'
  )
  for (const [i] of testCases.entries()) {
    const testCase = testCases[i]

    if (-1 !== skipTests.indexOf(testCase.test_name)) {
      continue
    }
    runTestCase(testCase, t)
  }
  t.end()
})
