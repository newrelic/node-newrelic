/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper.js')
const API    = require('../../../api.js')

const MAX_CUSTOM_EVENTS = 2

tap.test('Agent API - recordCustomEvent', (t) => {
  t.autoend()

  let agent = null
  let api = null

  t.beforeEach((done) => {
    agent = helper.loadMockedAgent({
      custom_insights_events: {
        max_samples_stored: MAX_CUSTOM_EVENTS
      }
    })
    api = new API(agent)

    done()
  })

  t.afterEach((done) => {
    helper.unloadAgent(agent)
    agent = null
    api = null

    done()
  })

  t.test('can be called without exploding', (t) => {
    t.doesNotThrow(() => {
      api.recordCustomEvent('EventName', {key: 'value'})
    })

    t.end()
  })

  t.test('does not throw an exception on invalid name', (t) => {
    t.doesNotThrow(() => {
      api.recordCustomEvent('éventñame', {key: 'value'})
    })

    t.end()
  })

  t.test('pushes the event into the customEvents pool', (t) => {
    api.recordCustomEvent('EventName', {key: 'value'})
    const myEvent = popTopCustomEvent(agent)
    t.ok(myEvent)

    t.end()
  })

  t.test('does not collect events when high security mode is on', (t) => {
    agent.config.high_security = true
    api.recordCustomEvent('EventName', {key: 'value'})

    const events = getCustomEvents(agent)
    t.equal(events.length, 0)

    t.end()
  })

  t.test('does not collect events when the endpoint is disabled in the config', (t) => {
    agent.config.api.custom_events_enabled = false
    api.recordCustomEvent('EventName', {key: 'value'})

    const events = getCustomEvents(agent)
    t.equal(events.length, 0)

    t.end()
  })

  t.test('creates the proper intrinsic values when recorded', (t) => {
    const when = Date.now()

    api.recordCustomEvent('EventName', {key: 'value'})

    const myEvent = popTopCustomEvent(agent)
    const [intrinsics] = myEvent

    t.ok(intrinsics)
    t.equal(intrinsics.type, 'EventName')
    t.ok(intrinsics.timestamp >= when)

    t.end()
  })

  t.test('adds the attributes the user asks for', (t) => {
    const data = {
      string: 'value',
      bool: true,
      number: 1
    }

    api.recordCustomEvent('EventName', data)

    const myEvent = popTopCustomEvent(agent)
    const userAttributes = myEvent[1]
    t.deepEqual(userAttributes, data)

    t.end()
  })

  t.test('filters object type values from user attributes', (t) => {
    const data = {
      string: 'value',
      object: {},
      array: [],
      undef: undefined,
      function: function() {},
      symbol: Symbol('test')
    }

    api.recordCustomEvent('EventName', data)

    const myEvent = popTopCustomEvent(agent)
    const userAttributes = myEvent[1]

    t.equal(userAttributes.string, 'value')

    const hasOwnAttribute = Object.hasOwnProperty.bind(userAttributes)

    t.notOk(hasOwnAttribute('object'))
    t.notOk(hasOwnAttribute('array'))
    t.notOk(hasOwnAttribute('function'))
    t.notOk(hasOwnAttribute('undef'))
    t.notOk(hasOwnAttribute('symbol'))

    t.end()
  })

  t.test('does not add events with invalid names', (t) => {
    api.recordCustomEvent('éventñame', {key: 'value'})

    const myEvent = popTopCustomEvent(agent)
    t.notOk(myEvent)

    t.end()
  })

  t.test('does not collect events when disabled', (t) => {
    agent.config.custom_insights_events = false

    api.recordCustomEvent('SomeEvent', {key: 'value'})

    const myEvent = popTopCustomEvent(agent)
    t.notOk(myEvent)

    agent.config.custom_insights_events = true
    t.end()
  })

  t.test('should sample after the limit of events', (t) => {
    api.recordCustomEvent('MaybeBumped', {a: 1})
    api.recordCustomEvent('MaybeBumped', {b: 2})
    api.recordCustomEvent('MaybeBumped', {c: 3})

    const customEvents = getCustomEvents(agent)
    t.equal(customEvents.length, MAX_CUSTOM_EVENTS)

    t.end()
  })

  t.test('should not throw an exception with too few arguments', (t) => {
    t.doesNotThrow(() => {
      api.recordCustomEvent()
    })

    t.doesNotThrow(() => {
      api.recordCustomEvent('SomeThing')
    })

    t.end()
  })

  t.test('should reject events with object first arg', (t) => {
    api.recordCustomEvent({}, {alpha: 'beta'})

    const customEvent = popTopCustomEvent(agent)
    t.notOk(customEvent)

    t.end()
  })

  t.test('should reject events with array first arg', (t) => {
    api.recordCustomEvent([], {alpha: 'beta'})

    const customEvent = popTopCustomEvent(agent)
    t.notOk(customEvent)

    t.end()
  })

  t.test('should reject events with number first arg', (t) => {
    api.recordCustomEvent(1, {alpha: 'beta'})

    const customEvent = popTopCustomEvent(agent)
    t.notOk(customEvent)

    t.end()
  })

  t.test('should reject events with undfined first arg', (t) => {
    api.recordCustomEvent(undefined, {alpha: 'beta'})

    const customEvent = popTopCustomEvent(agent)
    t.notOk(customEvent)

    t.end()
  })

  t.test('should reject events with null first arg', (t) => {
    api.recordCustomEvent(null, {alpha: 'beta'})

    const customEvent = popTopCustomEvent(agent)
    t.notOk(customEvent)

    t.end()
  })

  t.test('should reject events with string second arg', (t) => {
    api.recordCustomEvent('EventThing', 'thing')

    const customEvent = popTopCustomEvent(agent)
    t.notOk(customEvent)

    t.end()
  })

  t.test('should reject events with array second arg', (t) => {
    api.recordCustomEvent('EventThing', [])

    const customEvent = popTopCustomEvent(agent)
    t.notOk(customEvent)

    t.end()
  })

  t.test('should reject events with number second arg', (t) => {
    api.recordCustomEvent('EventThing', 1)

    const customEvent = popTopCustomEvent(agent)
    t.notOk(customEvent)

    t.end()
  })

  t.test('should reject events with undefined second arg', (t) => {
    api.recordCustomEvent('EventThing', undefined)

    const customEvent = popTopCustomEvent(agent)
    t.notOk(customEvent)

    t.end()
  })

  t.test('should reject events with null second arg', (t) => {
    api.recordCustomEvent('EventThing', null)

    const customEvent = popTopCustomEvent(agent)
    t.notOk(customEvent)

    t.end()
  })

  t.test('should reject events with a type greater than 255 chars', (t) => {
    const badType = new Array(257).join('a')
    api.recordCustomEvent(badType, {ship: 'every week'})

    const customEvent = popTopCustomEvent(agent)
    t.notOk(customEvent)

    t.end()
  })

  t.test('should reject events with an attribute key greater than 255 chars', (t) => {
    const badKey = new Array(257).join('b')
    const attributes = {}
    attributes[badKey] = true

    api.recordCustomEvent('MyType', attributes)

    const customEvent = popTopCustomEvent(agent)
    t.notOk(customEvent)

    t.end()
  })
})

function popTopCustomEvent(agent) {
  return getCustomEvents(agent).pop()
}

function getCustomEvents(agent) {
  return agent.customEventAggregator.events.toArray()
}
