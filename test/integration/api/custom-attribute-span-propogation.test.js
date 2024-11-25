/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const API = require('../../../api')
const AttributeFilter = require('../../../lib/config/attribute-filter')
const helper = require('../../lib/agent_helper')

const DESTINATIONS = AttributeFilter.DESTINATIONS

test('#addAttribute', async (t) => {
  t.beforeEach((ctx) => {
    const agent = helper.loadMockedAgent({
      distributed_tracing: {
        enabled: true
      }
    })
    const api = new API(agent)
    ctx.nr = {
      agent,
      api
    }
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should add attribute to current span', (t, end) => {
    const { agent, api } = t.nr
    helper.runInTransaction(agent, () => {
      api.startSegment('segment1', true, () => {
        api.addCustomAttribute('key1', 'value1')

        const customSpanAttributes = getCustomSpanAttributes(agent)
        assert.equal(customSpanAttributes.key1, 'value1')

        end()
      })
    })
  })

  await t.test('should overwrite for same key added via addCustomAttribute', (t, end) => {
    const { agent, api } = t.nr
    helper.runInTransaction(agent, () => {
      api.startSegment('segment1', true, () => {
        api.addCustomAttribute('key1', 'value1')
        api.addCustomAttribute('key1', 'last-wins')

        const customSpanAttributes = getCustomSpanAttributes(agent)
        assert.equal(customSpanAttributes.key1, 'last-wins')

        end()
      })
    })
  })

  await t.test('should not overwrite for same key added via addCustomSpanAttribute', (t, end) => {
    const { agent, api } = t.nr
    helper.runInTransaction(agent, () => {
      api.startSegment('segment1', true, () => {
        api.addCustomSpanAttribute('key1', 'custom-span-wins')
        api.addCustomAttribute('key1', 'does-not-overwrite')

        const customSpanAttributes = getCustomSpanAttributes(agent)
        assert.equal(customSpanAttributes.key1, 'custom-span-wins')

        end()
      })
    })
  })

  await t.test('should not add attribute when over the limit', (t, end) => {
    const { agent, api } = t.nr
    helper.runInTransaction(agent, () => {
      api.startSegment('segment1', true, () => {
        // the cap is 64
        batchAddCustomAttributes(api, 32)
        batchAddCustomSpanAttributes(api, 32)

        const unexpectedAttributeName = 'should-not-exist'
        api.addCustomAttribute(unexpectedAttributeName, 'does-not-exist')

        const customSpanAttributes = getCustomSpanAttributes(agent)
        const hasAttribute = Object.hasOwnProperty.bind(customSpanAttributes)

        assert.ok(!hasAttribute(unexpectedAttributeName))

        end()
      })
    })
  })
})

test('#addCustomSpanAttribute', async (t) => {
  t.beforeEach((ctx) => {
    const agent = helper.loadMockedAgent({
      distributed_tracing: {
        enabled: true
      }
    })
    const api = new API(agent)
    ctx.nr = {
      agent,
      api
    }
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should not add attribute to transaction', (t, end) => {
    const { agent, api } = t.nr
    helper.runInTransaction(agent, (transaction) => {
      api.startSegment('segment1', true, () => {
        const unexpectedAttributeName = 'should-not-exist'
        api.addCustomSpanAttribute(unexpectedAttributeName, 'does-not-exist')

        const customTransactionAttributes = getCustomTransactionAttributes(transaction)
        const hasAttribute = Object.hasOwnProperty.bind(customTransactionAttributes)

        assert.ok(!hasAttribute(unexpectedAttributeName))

        end()
      })
    })
  })

  await t.test('should overwrite for same key added via addCustomAttribute', (t, end) => {
    const { agent, api } = t.nr
    helper.runInTransaction(agent, () => {
      api.startSegment('segment1', true, () => {
        api.addCustomAttribute('key1', 'value1')
        api.addCustomSpanAttribute('key1', 'custom-span-wins')

        const customSpanAttributes = getCustomSpanAttributes(agent)

        assert.equal(customSpanAttributes.key1, 'custom-span-wins')

        end()
      })
    })
  })

  await t.test('should overwrite for same key added via addCustomSpanAttribute', (t, end) => {
    const { agent, api } = t.nr
    helper.runInTransaction(agent, () => {
      api.startSegment('segment1', true, () => {
        api.addCustomSpanAttribute('key1', 'value1')
        api.addCustomSpanAttribute('key1', 'last-wins')

        const customSpanAttributes = getCustomSpanAttributes(agent)

        assert.equal(customSpanAttributes.key1, 'last-wins')

        end()
      })
    })
  })

  await t.test(
    'should replace newest added via addCustomAttribute when over the limit',
    (t, end) => {
      const { agent, api } = t.nr
      helper.runInTransaction(agent, () => {
        api.startSegment('segment1', true, () => {
          // the cap is 64
          const lastAddedName = batchAddCustomAttributes(api, 32)
          batchAddCustomSpanAttributes(api, 32)

          api.addCustomSpanAttribute('should-replace-add-custom', 'replaced')

          const customSpanAttributes = getCustomSpanAttributes(agent)
          const hasAttribute = Object.hasOwnProperty.bind(customSpanAttributes)

          assert.ok(!hasAttribute(lastAddedName), 'should drop last added via addCustomAttribute')

          assert.equal(customSpanAttributes['should-replace-add-custom'], 'replaced')

          end()
        })
      })
    }
  )

  await t.test(
    'should not replace any added via addCustomSpanAttribute when over the limit',
    (t, end) => {
      const { agent, api } = t.nr
      helper.runInTransaction(agent, () => {
        api.startSegment('segment1', true, () => {
          // the cap is 64
          batchAddCustomSpanAttributes(api, 64)

          const unexpectedAttributeName = 'should-not-replace-add-custom-span'
          api.addCustomSpanAttribute(unexpectedAttributeName, 'does-not-exist')

          const customSpanAttributes = getCustomSpanAttributes(agent)
          const hasAttribute = Object.hasOwnProperty.bind(customSpanAttributes)

          assert.ok(!hasAttribute(unexpectedAttributeName))
          end()
        })
      })
    }
  )
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
