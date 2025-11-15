/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const API = require('../../../stub_api')

test('Agent API - Stubbed Agent API', async (t) => {
  const apiCalls = Object.keys(API.prototype)
  t.beforeEach((ctx) => {
    ctx.nr = {
      api: new API()
    }
  })

  for (const key of apiCalls) {
    await testApiStubMethod(key)
  }

  /**
   * This tests that every API method is a function and
   * does not throw when calling it.
   * @param {string} name method name to test
   */
  async function testApiStubMethod(name) {
    await t.test(`should export a stub of API#${name}`, (t, end) => {
      const { api } = t.nr
      assert.ok(api[name])
      assert.equal(typeof api[name], 'function')
      assert.doesNotThrow(() => {
        api[name]('arg')
      })
      end()
    })
  }

  /**
   * All tests below test bespoke behavior of smoe of the stubbed API methods.
   */

  await t.test('exports a function for getting linking metadata', (t, end) => {
    const { api } = t.nr
    const metadata = api.getLinkingMetadata()
    assert.equal(typeof metadata, 'object')

    end()
  })

  await t.test('exports a function for getting trace metadata', (t, end) => {
    const { api } = t.nr
    assert.ok(api.getTraceMetadata)
    assert.equal(typeof api.getTraceMetadata, 'function')

    const metadata = api.getTraceMetadata()
    assert.equal(typeof metadata, 'object')
    assert.equal(typeof metadata.traceId, 'string')
    assert.equal(metadata.traceId, '')
    assert.equal(typeof metadata.spanId, 'string')
    assert.equal(metadata.spanId, '')

    end()
  })

  await t.test('should return an empty string when requesting browser monitoring', (t, end) => {
    const { api } = t.nr
    const header = api.getBrowserTimingHeader()
    assert.equal(header, '')

    end()
  })

  await t.test('should return a function when calling setLambdaHandler', (t, end) => {
    const { api } = t.nr
    function myNop() {}
    const retVal = api.setLambdaHandler(myNop)
    assert.equal(retVal, myNop)

    end()
  })

  await t.test('should call the function passed into `startSegment`', (t, end) => {
    const { api } = t.nr
    api.startSegment('foo', false, () => {
      end()
    })
  })

  await t.test('should not throw when a non-function is passed to `startSegment`', (t, end) => {
    const { api } = t.nr
    assert.doesNotThrow(() => {
      api.startSegment('foo', false, null)
    })

    end()
  })

  await t.test('should return the return value of the handler', (t, end) => {
    const { api } = t.nr
    const obj = {}
    const ret = api.startSegment('foo', false, function () {
      return obj
    })
    assert.equal(obj, ret)

    end()
  })

  await t.test("shouldn't throw when a custom web transaction is started", (t, end) => {
    const { api } = t.nr
    assert.doesNotThrow(() => {
      api.startWebTransaction('test', function nop() {})
    })

    end()
  })

  await t.test('should call the function passed into startWebTransaction', (t, end) => {
    const { api } = t.nr
    api.startWebTransaction('test', function nop() {
      end()
    })
  })

  await t.test(
    "shouldn't throw when a callback isn't passed into startWebTransaction",
    (t, end) => {
      const { api } = t.nr
      assert.doesNotThrow(() => {
        api.startWebTransaction('test')
      })

      end()
    }
  )

  await t.test(
    "shouldn't throw when a non-function callback is passed into startWebTransaction",
    (t, end) => {
      const { api } = t.nr
      assert.doesNotThrow(() => {
        api.startWebTransaction('test', 'asdf')
      })

      end()
    }
  )

  await t.test("shouldn't throw when a custom background transaction is started", (t, end) => {
    const { api } = t.nr
    assert.doesNotThrow(() => {
      api.startBackgroundTransaction('test', 'group', function nop() {})
    })

    end()
  })

  await t.test('should call the function passed into startBackgroundTransaction', (t, end) => {
    const { api } = t.nr
    api.startBackgroundTransaction('test', 'group', function nop() {
      end()
    })
  })

  await t.test(
    "shouldn't throw when a callback isn't passed into startBackgroundTransaction",
    (t, end) => {
      const { api } = t.nr
      assert.doesNotThrow(() => {
        api.startBackgroundTransaction('test', 'group')
      })

      end()
    }
  )

  await t.test(
    "shouldn't throw when non-function callback is passed to startBackgroundTransaction",
    (t, end) => {
      const { api } = t.nr
      assert.doesNotThrow(() => {
        api.startBackgroundTransaction('test', 'group', 'asdf')
      })

      end()
    }
  )

  await t.test(
    "shouldn't throw when a custom background transaction is started with no group",
    (t, end) => {
      const { api } = t.nr
      assert.doesNotThrow(() => {
        api.startBackgroundTransaction('test', function nop() {})
      })

      end()
    }
  )

  await t.test(
    'should call the function passed into startBackgroundTransaction with no group',
    (t, end) => {
      const { api } = t.nr
      api.startBackgroundTransaction('test', function nop() {
        end()
      })
    }
  )

  await t.test(
    "shouldn't throw when a callback isn't passed into startBackgroundTransaction " +
      'with no group',
    (t, end) => {
      const { api } = t.nr
      assert.doesNotThrow(() => {
        api.startBackgroundTransaction('test')
      })

      end()
    }
  )

  await t.test('returns a TransactionHandle stub on getTransaction', (t, end) => {
    const { api } = t.nr
    const Stub = api.getTransaction()
    assert.equal(Stub.constructor.name, 'TransactionHandleStub')
    end()
  })
})
