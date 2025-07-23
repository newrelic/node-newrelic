/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const helper = require('../lib/agent_helper')
const { Attributes } = require('../../lib/attributes')
const AttributeFilter = require('../../lib/config/attribute-filter')

const DESTINATIONS = AttributeFilter.DESTINATIONS
const TRANSACTION_SCOPE = 'transaction'

test('#addAttribute', async (t) => {
  await t.test('adds an attribute to instance', () => {
    const inst = new Attributes({ scope: TRANSACTION_SCOPE })
    inst.addAttribute(DESTINATIONS.TRANS_SCOPE, 'test', 'success')
    const attributes = inst.get(DESTINATIONS.TRANS_SCOPE)

    assert.equal(attributes.test, 'success')
  })

  await t.test('does not add attribute if key length limit is exceeded', () => {
    const tooLong = [
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      'Cras id lacinia erat. Suspendisse mi nisl, sodales vel est eu,',
      'rhoncus lacinia ante. Nulla tincidunt efficitur diam, eget vulputate',
      'lectus facilisis sit amet. Morbi hendrerit commodo quam, in nullam.'
    ].join(' ')

    const inst = new Attributes({ scope: TRANSACTION_SCOPE })
    inst.addAttribute(DESTINATIONS.TRANS_SCOPE, tooLong, 'will fail')
    const attributes = Object.keys(inst.attributes)

    assert.equal(attributes.length, 0)
  })
})

test('#addAttributes', async (t) => {
  await t.test('adds multiple attributes to instance', () => {
    const inst = new Attributes({ scope: TRANSACTION_SCOPE })
    inst.addAttributes(DESTINATIONS.TRANS_SCOPE, { one: '1', two: '2' })
    const attributes = inst.get(DESTINATIONS.TRANS_SCOPE)

    assert.equal(attributes.one, '1')
    assert.equal(attributes.two, '2')
  })

  await t.test('only allows non-null-type primitive attribute values', () => {
    const inst = new Attributes({ scope: TRANSACTION_SCOPE, limit: 10 })
    const attributes = {
      first: 'first',
      second: ['second'],
      third: { key: 'third' },
      fourth: 4,
      fifth: true,
      sixth: undefined,
      seventh: null,
      eighth: Symbol('test'),
      ninth: function () {}
    }

    inst.addAttributes(DESTINATIONS.TRANS_SCOPE, attributes)

    const res = inst.get(DESTINATIONS.TRANS_SCOPE)
    assert.equal(Object.keys(res).length, 3)

    const hasAttribute = Object.hasOwnProperty.bind(res)
    assert.equal(hasAttribute('second'), false)
    assert.equal(hasAttribute('third'), false)
    assert.equal(hasAttribute('sixth'), false)
    assert.equal(hasAttribute('seventh'), false)
    assert.equal(hasAttribute('eighth'), false)
    assert.equal(hasAttribute('ninth'), false)
  })

  await t.test('disallows adding more than maximum allowed attributes', () => {
    const inst = new Attributes({ scope: TRANSACTION_SCOPE, limit: 3 })
    const attributes = {
      first: 1,
      second: 2,
      portishead: 3,
      so: 4
    }

    inst.addAttributes(DESTINATIONS.TRANS_SCOPE, attributes)
    const res = inst.get(DESTINATIONS.TRANS_SCOPE)

    assert.equal(Object.keys(res).length, 3)
  })

  await t.test('Overwrites value of added attribute with same key', () => {
    const inst = new Attributes({ scope: TRANSACTION_SCOPE, limit: 2 })
    inst.addAttribute(0x01, 'Roboto', 1)
    inst.addAttribute(0x01, 'Roboto', 99)

    const res = inst.get(0x01)

    assert.equal(Object.keys(res).length, 1)
    assert.equal(res.Roboto, 99)
  })
})

test('#get', async (t) => {
  await t.test('gets attributes by destination, truncating values if necessary', () => {
    const longVal = [
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      'Cras id lacinia erat. Suspendisse mi nisl, sodales vel est eu,',
      'rhoncus lacinia ante. Nulla tincidunt efficitur diam, eget vulputate',
      'lectus facilisis sit amet. Morbi hendrerit commodo quam, in nullam.',
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'
    ].join(' ')

    const inst = new Attributes({ scope: TRANSACTION_SCOPE })
    inst.addAttribute(0x01, 'valid', 50)
    inst.addAttribute(0x01, 'tooLong', longVal)
    inst.addAttribute(0x08, 'wrongDest', 'hello')

    assert.ok(Buffer.byteLength(longVal) > 256)

    const res = inst.get(0x01)
    assert.equal(res.valid, 50)

    assert.equal(Buffer.byteLength(res.tooLong), 256)
  })

  await t.test('only returns attributes up to specified limit', () => {
    const inst = new Attributes({ scope: TRANSACTION_SCOPE, limit: 2 })
    inst.addAttribute(0x01, 'first', 'first')
    inst.addAttribute(0x01, 'second', 'second')
    inst.addAttribute(0x01, 'third', 'third')

    const res = inst.get(0x01)
    const hasAttribute = Object.hasOwnProperty.bind(res)

    assert.equal(Object.keys(res).length, 2)
    assert.equal(hasAttribute('third'), false)
  })

  await t.test('truncates to default maximum', () => {
    const tooLong = 'a'.repeat(255) + 'b' + ' to be dropped'
    const inst = new Attributes({ scope: TRANSACTION_SCOPE })
    inst.addAttribute(DESTINATIONS.TRANS_SCOPE, 'foo', tooLong)

    const attrs = inst.get(DESTINATIONS.TRANS_SCOPE)
    assert.equal(attrs.foo.length, 256)
    assert.equal(attrs.foo.endsWith('ab'), true)
  })

  await t.test('truncates to hard maximum', () => {
    const tooLong = 'a'.repeat(4_095) + 'b' + ' to be dropped'
    const inst = new Attributes({ scope: TRANSACTION_SCOPE, valueLengthLimit: 6_000 })
    inst.addAttribute(DESTINATIONS.TRANS_SCOPE, 'foo', tooLong)

    const attrs = inst.get(DESTINATIONS.TRANS_SCOPE)
    assert.equal(attrs.foo.length, 4_096)
    assert.equal(attrs.foo.endsWith('ab'), true)
  })
})

test('#hasValidDestination', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent()
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should return true if single destination valid', () => {
    const attributes = new Attributes({ scope: TRANSACTION_SCOPE })
    const hasDestination = attributes.hasValidDestination(DESTINATIONS.TRANS_EVENT, 'testAttr')

    assert.equal(hasDestination, true)
  })

  await t.test('should return true if all destinations valid', () => {
    const attributes = new Attributes({ scope: TRANSACTION_SCOPE })
    const destinations = DESTINATIONS.TRANS_EVENT | DESTINATIONS.TRANS_TRACE
    const hasDestination = attributes.hasValidDestination(destinations, 'testAttr')

    assert.equal(hasDestination, true)
  })

  await t.test('should return true if only one destination valid', (t) => {
    const { agent } = t.nr
    const attributeName = 'testAttr'
    agent.config.transaction_events.attributes.exclude = [attributeName]
    agent.config.emit('transaction_events.attributes.exclude')

    const attributes = new Attributes({ scope: TRANSACTION_SCOPE })
    const destinations = DESTINATIONS.TRANS_EVENT | DESTINATIONS.TRANS_TRACE
    const hasDestination = attributes.hasValidDestination(destinations, attributeName)

    assert.equal(hasDestination, true)
  })

  await t.test('should return false if no valid destinations', (t) => {
    const { agent } = t.nr
    const attributeName = 'testAttr'
    agent.config.attributes.exclude = [attributeName]
    agent.config.emit('attributes.exclude')

    const attributes = new Attributes({ scope: TRANSACTION_SCOPE })
    const destinations = DESTINATIONS.TRANS_EVENT | DESTINATIONS.TRANS_TRACE
    const hasDestination = attributes.hasValidDestination(destinations, attributeName)

    assert.equal(hasDestination, false)
  })
})

test('#reset', async (t) => {
  await t.test('resets instance attributes', () => {
    const inst = new Attributes({ scope: TRANSACTION_SCOPE })
    inst.addAttribute(0x01, 'first', 'first')
    inst.addAttribute(0x01, 'second', 'second')
    inst.addAttribute(0x01, 'third', 'third')

    inst.reset()

    assert.deepEqual(inst.attributes, {})
  })
})
