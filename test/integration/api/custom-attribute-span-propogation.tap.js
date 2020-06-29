/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const API = require('../../../api')
const AttributeFilter = require('../../../lib/config/attribute-filter')
const helper = require('../../lib/agent_helper')

const DESTINATIONS = AttributeFilter.DESTINATIONS

tap.test('#addAttribute', (t) => {
  t.autoend()

  let agent = null
  let api = null

  t.beforeEach((done) => {
    agent = helper.loadMockedAgent({
      distributed_tracing: {
        enabled: true
      }
    })
    api = new API(agent)
    done()
  })

  t.afterEach((done) => {
    helper.unloadAgent(agent)
    done()
  })

  t.test('should add attribute to current span', (t) => {
    helper.runInTransaction(agent, () => {
      api.startSegment('segment1', true, () => {
        api.addCustomAttribute('key1', 'value1')

        const customSpanAttributes = getCustomSpanAttributes(agent)
        t.equal(customSpanAttributes.key1, 'value1')

        t.end()
      })
    })
  })

  t.test('should overwrite for same key added via addCustomAttribute', (t) => {
    helper.runInTransaction(agent, () => {
      api.startSegment('segment1', true, () => {
        api.addCustomAttribute('key1', 'value1')
        api.addCustomAttribute('key1', 'last-wins')

        const customSpanAttributes = getCustomSpanAttributes(agent)
        t.equal(customSpanAttributes.key1, 'last-wins')

        t.end()
      })
    })
  })

  t.test('should not overwrite for same key added via addCustomSpanAttribute', (t) => {
    helper.runInTransaction(agent, () => {
      api.startSegment('segment1', true, () => {
        api.addCustomSpanAttribute('key1', 'custom-span-wins')
        api.addCustomAttribute('key1', 'does-not-overwrite')

        const customSpanAttributes = getCustomSpanAttributes(agent)
        t.equal(customSpanAttributes.key1, 'custom-span-wins')

        t.end()
      })
    })
  })

  t.test('should not add attribute when over the limit', (t) => {
    helper.runInTransaction(agent, () => {
      api.startSegment('segment1', true, () => {
        // the cap is 64
        batchAddCustomAttributes(api, 32)
        batchAddCustomSpanAttributes(api, 32)

        const unexpectedAttributeName = 'should-not-exist'
        api.addCustomAttribute(unexpectedAttributeName, 'does-not-exist')

        const customSpanAttributes = getCustomSpanAttributes(agent)
        const hasAttribute = Object.hasOwnProperty.bind(customSpanAttributes)

        t.notOk(hasAttribute(unexpectedAttributeName))

        t.end()
      })
    })
  })
})

tap.test('#addCustomSpanAttribute', (t) => {
  t.autoend()

  let agent = null
  let api = null

  t.beforeEach((done) => {
    agent = helper.loadMockedAgent({
      distributed_tracing: {
        enabled: true
      }
    })
    api = new API(agent)
    done()
  })

  t.afterEach((done) => {
    helper.unloadAgent(agent)
    done()
  })

  t.test('should not add attribute to transaction', (t) => {
    helper.runInTransaction(agent, (transaction) => {
      api.startSegment('segment1', true, () => {
        const unexpectedAttributeName = 'should-not-exist'
        api.addCustomSpanAttribute(unexpectedAttributeName, 'does-not-exist')

        const customTransactionAttributes = getCustomTransactionAttributes(transaction)
        const hasAttribute = Object.hasOwnProperty.bind(customTransactionAttributes)

        t.notOk(hasAttribute(unexpectedAttributeName))

        t.end()
      })
    })
  })

  t.test('should overwrite for same key added via addCustomAttribute', (t) => {
    helper.runInTransaction(agent, () => {
      api.startSegment('segment1', true, () => {
        api.addCustomAttribute('key1', 'value1')
        api.addCustomSpanAttribute('key1', 'custom-span-wins')

        const customSpanAttributes = getCustomSpanAttributes(agent)

        t.equal(customSpanAttributes.key1, 'custom-span-wins')

        t.end()
      })
    })
  })

  t.test('should overwrite for same key added via addCustomSpanAttribute', (t) => {
    helper.runInTransaction(agent, () => {
      api.startSegment('segment1', true, () => {
        api.addCustomSpanAttribute('key1', 'value1')
        api.addCustomSpanAttribute('key1', 'last-wins')

        const customSpanAttributes = getCustomSpanAttributes(agent)

        t.equal(customSpanAttributes.key1, 'last-wins')

        t.end()
      })
    })
  })

  t.test('should replace newest added via addCustomAttribute when over the limit', (t) => {
    helper.runInTransaction(agent, () => {
      api.startSegment('segment1', true, () => {
        // the cap is 64
        const lastAddedName = batchAddCustomAttributes(api, 32)
        batchAddCustomSpanAttributes(api, 32)

        api.addCustomSpanAttribute('should-replace-add-custom', 'replaced')

        const customSpanAttributes = getCustomSpanAttributes(agent)
        const hasAttribute = Object.hasOwnProperty.bind(customSpanAttributes)

        t.notOk(hasAttribute(lastAddedName), 'should drop last added via addCustomAttribute')

        t.equal(customSpanAttributes['should-replace-add-custom'], 'replaced')

        t.end()
      })
    })
  })

  t.test('should not replace any added via addCustomSpanAttribute when over the limit', (t) => {
    helper.runInTransaction(agent, () => {
      api.startSegment('segment1', true, () => {
        // the cap is 64
        batchAddCustomSpanAttributes(api, 64)

        const unexpectedAttributeName = 'should-not-replace-add-custom-span'
        api.addCustomSpanAttribute(unexpectedAttributeName, 'does-not-exist')

        const customSpanAttributes = getCustomSpanAttributes(agent)
        const hasAttribute = Object.hasOwnProperty.bind(customSpanAttributes)

        t.notOk(hasAttribute(unexpectedAttributeName))

        t.end()
      })
    })
  })
})

function getCustomSpanAttributes(agent) {
  const spanContext = agent.tracer.getSpanContext()
  return spanContext && spanContext.customAttributes.get(DESTINATIONS.SPAN_EVENT)
}

function getCustomTransactionAttributes(transaction) {
  return transaction.trace.custom.get(DESTINATIONS.TRANS_SCOPE)
}

function batchAddCustomAttributes(api, attributeCount) {
  let addedName = null
  for (let i = 0; i < attributeCount; i++) {
    addedName = `custom-${i}`
    api.addCustomAttribute(addedName, i)
  }

  return addedName
}

function batchAddCustomSpanAttributes(api, attributeCount) {
  for (let i = 0; i < attributeCount; i++) {
    api.addCustomSpanAttribute(`custom-span-${i}`, i)
  }
}
