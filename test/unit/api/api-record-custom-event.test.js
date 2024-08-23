/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper.js')
const API = require('../../../api.js')

const MAX_CUSTOM_EVENTS = 2

test('Agent API - recordCustomEvent', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const agent = helper.loadMockedAgent({
      custom_insights_events: {
        max_samples_stored: MAX_CUSTOM_EVENTS
      }
    })
    ctx.nr.api = new API(agent)
    ctx.nr.agent = agent
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('can be called without exploding', (t, end) => {
    const { api } = t.nr
    assert.doesNotThrow(() => {
      api.recordCustomEvent('EventName', { key: 'value' })
    })

    end()
  })

  await t.test('does not throw an exception on invalid name', (t, end) => {
    const { api } = t.nr
    assert.doesNotThrow(() => {
      api.recordCustomEvent('éventñame', { key: 'value' })
    })

    end()
  })

  await t.test('pushes the event into the customEvents pool', (t, end) => {
    const { agent, api } = t.nr
    api.recordCustomEvent('EventName', { key: 'value' })
    const myEvent = popTopCustomEvent(agent)
    assert.ok(myEvent)

    end()
  })

  await t.test('does not collect events when high security mode is on', (t, end) => {
    const { agent, api } = t.nr
    agent.config.high_security = true
    api.recordCustomEvent('EventName', { key: 'value' })

    const events = getCustomEvents(agent)
    assert.equal(events.length, 0)

    end()
  })

  await t.test('does not collect events when the endpoint is disabled in the config', (t, end) => {
    const { agent, api } = t.nr
    agent.config.api.custom_events_enabled = false
    api.recordCustomEvent('EventName', { key: 'value' })

    const events = getCustomEvents(agent)
    assert.equal(events.length, 0)

    end()
  })

  await t.test('creates the proper intrinsic values when recorded', (t, end) => {
    const { agent, api } = t.nr
    const when = Date.now()

    api.recordCustomEvent('EventName', { key: 'value' })

    const myEvent = popTopCustomEvent(agent)
    const [intrinsics] = myEvent

    assert.ok(intrinsics)
    assert.equal(intrinsics.type, 'EventName')
    assert.ok(intrinsics.timestamp >= when)

    end()
  })

  await t.test('adds the attributes the user asks for', (t, end) => {
    const { agent, api } = t.nr
    const data = {
      string: 'value',
      bool: true,
      number: 1
    }

    api.recordCustomEvent('EventName', data)

    const myEvent = popTopCustomEvent(agent)
    const userAttributes = myEvent[1]
    assert.deepEqual(userAttributes, data)

    end()
  })

  await t.test('filters object type values from user attributes', (t, end) => {
    const { agent, api } = t.nr
    const data = {
      string: 'value',
      object: {},
      array: [],
      undef: undefined,
      function: function () {},
      symbol: Symbol('test')
    }

    api.recordCustomEvent('EventName', data)

    const myEvent = popTopCustomEvent(agent)
    const userAttributes = myEvent[1]

    assert.equal(userAttributes.string, 'value')

    const hasOwnAttribute = Object.hasOwnProperty.bind(userAttributes)

    assert.ok(!hasOwnAttribute('object'))
    assert.ok(!hasOwnAttribute('array'))
    assert.ok(!hasOwnAttribute('function'))
    assert.ok(!hasOwnAttribute('undef'))
    assert.ok(!hasOwnAttribute('symbol'))

    end()
  })

  await t.test('does not add events with invalid names', (t, end) => {
    const { agent, api } = t.nr
    api.recordCustomEvent('éventñame', { key: 'value' })

    const myEvent = popTopCustomEvent(agent)
    assert.ok(!myEvent)

    end()
  })

  await t.test('does not collect events when disabled', (t, end) => {
    const { agent, api } = t.nr
    agent.config.custom_insights_events = false

    api.recordCustomEvent('SomeEvent', { key: 'value' })

    const myEvent = popTopCustomEvent(agent)
    assert.ok(!myEvent)

    agent.config.custom_insights_events = true
    end()
  })

  await t.test('should sample after the limit of events', (t, end) => {
    const { agent, api } = t.nr
    api.recordCustomEvent('MaybeBumped', { a: 1 })
    api.recordCustomEvent('MaybeBumped', { b: 2 })
    api.recordCustomEvent('MaybeBumped', { c: 3 })

    const customEvents = getCustomEvents(agent)
    assert.equal(customEvents.length, MAX_CUSTOM_EVENTS)

    end()
  })

  await t.test('should not throw an exception with too few arguments', (t, end) => {
    const { api } = t.nr
    assert.doesNotThrow(() => {
      api.recordCustomEvent()
    })

    assert.doesNotThrow(() => {
      api.recordCustomEvent('SomeThing')
    })

    end()
  })

  await t.test('should reject events with object first arg', (t, end) => {
    const { agent, api } = t.nr
    api.recordCustomEvent({}, { alpha: 'beta' })

    const customEvent = popTopCustomEvent(agent)
    assert.ok(!customEvent)

    end()
  })

  await t.test('should reject events with array first arg', (t, end) => {
    const { agent, api } = t.nr
    api.recordCustomEvent([], { alpha: 'beta' })

    const customEvent = popTopCustomEvent(agent)
    assert.ok(!customEvent)

    end()
  })

  await t.test('should reject events with number first arg', (t, end) => {
    const { agent, api } = t.nr
    api.recordCustomEvent(1, { alpha: 'beta' })

    const customEvent = popTopCustomEvent(agent)
    assert.ok(!customEvent)

    end()
  })

  await t.test('should reject events with undefined first arg', (t, end) => {
    const { agent, api } = t.nr
    api.recordCustomEvent(undefined, { alpha: 'beta' })

    const customEvent = popTopCustomEvent(agent)
    assert.ok(!customEvent)

    end()
  })

  await t.test('should reject events with null first arg', (t, end) => {
    const { agent, api } = t.nr
    api.recordCustomEvent(null, { alpha: 'beta' })

    const customEvent = popTopCustomEvent(agent)
    assert.ok(!customEvent)

    end()
  })

  await t.test('should reject events with string second arg', (t, end) => {
    const { agent, api } = t.nr
    api.recordCustomEvent('EventThing', 'thing')

    const customEvent = popTopCustomEvent(agent)
    assert.ok(!customEvent)

    end()
  })

  await t.test('should reject events with array second arg', (t, end) => {
    const { agent, api } = t.nr
    api.recordCustomEvent('EventThing', [])

    const customEvent = popTopCustomEvent(agent)
    assert.ok(!customEvent)

    end()
  })

  await t.test('should reject events with number second arg', (t, end) => {
    const { agent, api } = t.nr
    api.recordCustomEvent('EventThing', 1)

    const customEvent = popTopCustomEvent(agent)
    assert.ok(!customEvent)

    end()
  })

  await t.test('should reject events with undefined second arg', (t, end) => {
    const { agent, api } = t.nr
    api.recordCustomEvent('EventThing', undefined)

    const customEvent = popTopCustomEvent(agent)
    assert.ok(!customEvent)

    end()
  })

  await t.test('should reject events with null second arg', (t, end) => {
    const { agent, api } = t.nr
    api.recordCustomEvent('EventThing', null)

    const customEvent = popTopCustomEvent(agent)
    assert.ok(!customEvent)

    end()
  })

  await t.test('should reject events with a type greater than 255 chars', (t, end) => {
    const { agent, api } = t.nr
    const badType = new Array(257).join('a')
    api.recordCustomEvent(badType, { ship: 'every week' })

    const customEvent = popTopCustomEvent(agent)
    assert.ok(!customEvent)

    end()
  })

  await t.test('should reject events with an attribute key greater than 255 chars', (t, end) => {
    const { agent, api } = t.nr
    const badKey = new Array(257).join('b')
    const attributes = {}
    attributes[badKey] = true

    api.recordCustomEvent('MyType', attributes)

    const customEvent = popTopCustomEvent(agent)
    assert.ok(!customEvent)

    end()
  })
})

function popTopCustomEvent(agent) {
  return getCustomEvents(agent).pop()
}

function getCustomEvents(agent) {
  return agent.customEventAggregator.events.toArray()
}
