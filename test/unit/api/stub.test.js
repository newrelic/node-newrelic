/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const API = require('../../../stub_api')

const EXPECTED_API_COUNT = 36

tap.test('Agent API - Stubbed Agent API', (t) => {
  t.autoend()

  let api = null

  t.beforeEach(() => {
    api = new API()
  })

  t.test(`should export ${EXPECTED_API_COUNT - 1} API calls`, (t) => {
    const apiKeys = Object.keys(api.constructor.prototype)
    t.equal(apiKeys.length, EXPECTED_API_COUNT)
    t.end()
  })

  t.test('exports a transaction naming function', (t) => {
    t.ok(api.setTransactionName)
    t.type(api.setTransactionName, 'function')

    t.end()
  })

  t.test('exports a dispatcher naming function', (t) => {
    t.ok(api.setDispatcher)

    t.type(api.setDispatcher, 'function')

    t.end()
  })

  t.test("shouldn't throw when transaction is named", (t) => {
    t.doesNotThrow(() => {
      api.setTransactionName('TEST/*')
    })

    t.end()
  })

  t.test('exports a controller naming function', (t) => {
    t.ok(api.setControllerName)
    t.type(api.setControllerName, 'function')

    t.end()
  })

  t.test("shouldn't throw when controller is named without an action", (t) => {
    t.doesNotThrow(() => {
      api.setControllerName('TEST/*')
    })

    t.end()
  })

  t.test("shouldn't throw when controller is named with an action", (t) => {
    t.doesNotThrow(() => {
      api.setControllerName('TEST/*', 'test')
    })

    t.end()
  })

  t.test('exports a function to get the current transaction handle', (t) => {
    t.ok(api.getTransaction)
    t.type(api.getTransaction, 'function')

    t.end()
  })

  t.test('exports a function for adding naming rules', (t) => {
    t.ok(api.addNamingRule)
    t.type(api.addNamingRule, 'function')

    t.end()
  })

  t.test("shouldn't throw when a naming rule is added", (t) => {
    t.doesNotThrow(() => {
      api.addNamingRule(/^foo/, '/foo/*')
    })

    t.end()
  })

  t.test('exports a function for ignoring certain URLs', (t) => {
    t.ok(api.addIgnoringRule)
    t.type(api.addIgnoringRule, 'function')

    t.end()
  })

  t.test("shouldn't throw when an ignoring rule is added", (t) => {
    t.doesNotThrow(() => {
      api.addIgnoringRule(/^foo/, '/foo/*')
    })

    t.end()
  })

  t.test('exports a function for getting linking metadata', (t) => {
    t.ok(api.getLinkingMetadata)
    t.type(api.getTraceMetadata, 'function')

    const metadata = api.getLinkingMetadata()
    t.type(metadata, 'object')

    t.end()
  })

  t.test('exports a function for getting trace metadata', (t) => {
    t.ok(api.getTraceMetadata)
    t.type(api.getTraceMetadata, 'function')

    const metadata = api.getTraceMetadata()
    t.type(metadata, 'object')
    t.type(metadata.traceId, 'string')
    t.equal(metadata.traceId, '')
    t.type(metadata.spanId, 'string')
    t.equal(metadata.spanId, '')

    t.end()
  })

  t.test('exports a function for capturing errors', (t) => {
    t.ok(api.noticeError)
    t.type(api.noticeError, 'function')

    t.end()
  })

  t.test("shouldn't throw when an error is added", (t) => {
    t.doesNotThrow(() => {
      api.noticeError(new Error())
    })

    t.end()
  })

  t.test('should return an empty string when requesting browser monitoring', (t) => {
    const header = api.getBrowserTimingHeader()
    t.equal(header, '')

    t.end()
  })

  t.test("shouldn't throw when a custom parameter is added", (t) => {
    t.doesNotThrow(() => {
      api.addCustomAttribute('test', 'value')
    })

    t.end()
  })

  t.test('exports a function for adding multiple custom parameters at once', (t) => {
    t.ok(api.addCustomAttributes)
    t.type(api.addCustomAttributes, 'function')

    t.end()
  })

  t.test("shouldn't throw when multiple custom parameters are added", (t) => {
    t.doesNotThrow(() => {
      api.addCustomAttributes({ test: 'value', test2: 'value2' })
    })

    t.end()
  })

  t.test('should return a function when calling setLambdaHandler', (t) => {
    function myNop() {}
    const retVal = api.setLambdaHandler(myNop)
    t.equal(retVal, myNop)

    t.end()
  })

  t.test('should call the function passed into `startSegment`', (t) => {
    api.startSegment('foo', false, () => {
      t.end()
    })
  })

  t.test('should not throw when a non-function is passed to `startSegment`', (t) => {
    t.doesNotThrow(() => {
      api.startSegment('foo', false, null)
    })

    t.end()
  })

  t.test('should return the return value of the handler', (t) => {
    const obj = {}
    const ret = api.startSegment('foo', false, function () {
      return obj
    })
    t.equal(obj, ret)

    t.end()
  })

  t.test("shouldn't throw when a custom web transaction is started", (t) => {
    t.doesNotThrow(() => {
      api.startWebTransaction('test', function nop() {})
    })

    t.end()
  })

  t.test('should call the function passed into startWebTransaction', (t) => {
    api.startWebTransaction('test', function nop() {
      t.end()
    })
  })

  t.test("shouldn't throw when a callback isn't passed into startWebTransaction", (t) => {
    t.doesNotThrow(() => {
      api.startWebTransaction('test')
    })

    t.end()
  })

  t.test("shouldn't throw when a non-function callback is passed into startWebTransaction", (t) => {
    t.doesNotThrow(() => {
      api.startWebTransaction('test', 'asdf')
    })

    t.end()
  })

  t.test("shouldn't throw when a custom background transaction is started", (t) => {
    t.doesNotThrow(() => {
      api.startBackgroundTransaction('test', 'group', function nop() {})
    })

    t.end()
  })

  t.test('should call the function passed into startBackgroundTransaction', (t) => {
    api.startBackgroundTransaction('test', 'group', function nop() {
      t.end()
    })
  })

  t.test("shouldn't throw when a callback isn't passed into startBackgroundTransaction", (t) => {
    t.doesNotThrow(() => {
      api.startBackgroundTransaction('test', 'group')
    })

    t.end()
  })

  t.test(
    "shouldn't throw when non-function callback is passed to startBackgroundTransaction",
    (t) => {
      t.doesNotThrow(() => {
        api.startBackgroundTransaction('test', 'group', 'asdf')
      })

      t.end()
    }
  )

  t.test("shouldn't throw when a custom background transaction is started with no group", (t) => {
    t.doesNotThrow(() => {
      api.startBackgroundTransaction('test', function nop() {})
    })

    t.end()
  })

  t.test('should call the function passed into startBackgroundTransaction with no group', (t) => {
    api.startBackgroundTransaction('test', function nop() {
      t.end()
    })
  })

  t.test(
    "shouldn't throw when a callback isn't passed into startBackgroundTransaction " +
      'with no group',
    (t) => {
      t.doesNotThrow(() => {
        api.startBackgroundTransaction('test')
      })

      t.end()
    }
  )

  t.test("shouldn't throw when a transaction is ended", (t) => {
    t.doesNotThrow(() => {
      api.endTransaction()
    })

    t.end()
  })

  t.test('exports a metric recording function', (t) => {
    t.ok(api.recordMetric)
    t.type(api.recordMetric, 'function')

    t.end()
  })

  t.test('should not throw when calling the metric recorder', (t) => {
    t.doesNotThrow(() => {
      api.recordMetric('metricname', 1)
    })

    t.end()
  })

  t.test('exports a metric increment function', (t) => {
    t.ok(api.incrementMetric)
    t.type(api.incrementMetric, 'function')

    t.end()
  })

  t.test('should not throw when calling a metric incrementor', (t) => {
    t.doesNotThrow(() => {
      api.incrementMetric('metric name')
    })

    t.end()
  })

  t.test('exports a record custom event function', (t) => {
    t.ok(api.recordCustomEvent)
    t.type(api.recordCustomEvent, 'function')

    t.end()
  })

  t.test('should not throw when calling the custom metric recorder', (t) => {
    t.doesNotThrow(() => {
      api.recordCustomEvent('EventName', { id: 10 })
    })

    t.end()
  })

  t.test('exports llm message api', (t) => {
    t.type(api.recordLlmFeedbackEvent, 'function')
    t.end()
  })

  t.test('exports ignoreApdex', (t) => {
    t.type(api.ignoreApdex, 'function')
    t.end()
  })
})
