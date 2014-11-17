'use strict'

var chai   = require('chai')
var expect = chai.expect
var helper = require('../../lib/agent_helper.js')
var API    = require('../../../api.js')


describe('The custom events API', function () {
  var agent
  var api

  beforeEach(function () {
    agent = helper.loadMockedAgent({custom_events: true})
    api = new API(agent)
  })

  afterEach(function () {
    helper.unloadAgent(agent)
  })

  it('can be called without exploding', function () {
    expect(function () {
      api.recordCustomEvent('EventName', {key: 'value'})
    }).not.throws()
  })

  it('does not throw an exception on invalid name', function () {
    expect(function () {
      api.recordCustomEvent('éventñame', {key: 'value'})
    }).not.throws()
  })

  it('pushes the event into the customEvents pool', function () {
    api.recordCustomEvent('EventName', {key: 'value'})
    var myEvent = popTopCustomEvent(agent)
    expect(myEvent).to.exist
  })

  it('creates the proper intrinsic values when recorded', function () {
    var when = Date.now()
    api.recordCustomEvent('EventName', {key: 'value'})
    var myEvent = popTopCustomEvent(agent)
    expect(myEvent[0]).to.exist
    expect(myEvent[0].type).to.equal('EventName')
    expect(myEvent[0].source).to.equal('Customer')
    expect(myEvent[0].timestamp).to.be.at.least(when)
  })

  it('adds the attributes the user asks for', function () {
    var data = {
      string: 'value',
      bool: true,
      number: 1
    }
    api.recordCustomEvent('EventName', data)
    var myEvent = popTopCustomEvent(agent)
    expect(myEvent[1]).to.equal(data)
  })

  it('does not add events with invalid names', function () {
    api.recordCustomEvent('éventñame', {key: 'value'})
    var myEvent = popTopCustomEvent(agent)
    expect(myEvent).to.not.exist
  })

  it('does not collect events when disabled', function () {
    agent.config.custom_insights_events = false
    api.recordCustomEvent('SomeEvent', {key: 'value'})
    var myEvent = popTopCustomEvent(agent)
    expect(myEvent).to.not.exist
    agent.config.custom_insights_events = true
  })

  it('should sample after the limit of events', function () {
    agent.customEvents.limit = 2
    api.recordCustomEvent('MaybeBumped', {a: 1})
    api.recordCustomEvent('MaybeBumped', {b: 2})
    api.recordCustomEvent('MaybeBumped', {c: 3})
    expect(agent.customEvents.toArray()).to.have.length(2)
  })

  it('should not throw an exception with too few arguments', function () {
    expect(function () {
      api.recordCustomEvent()
    }).not.throws()

    expect(function () {
      api.recordCustomEvent('SomeThing')
    }).not.throws()
  })

  it('should reject events with object first arg', function () {
    api.recordCustomEvent({}, {alpha: 'beta'})
    expect(popTopCustomEvent(agent)).to.not.exist
  })

  it('should reject events with array first arg', function () {
    api.recordCustomEvent([], {alpha: 'beta'})
    expect(popTopCustomEvent(agent)).to.not.exist
  })

  it('should reject events with number first arg', function () {
    api.recordCustomEvent(1, {alpha: 'beta'})
    expect(popTopCustomEvent(agent)).to.not.exist
  })

  it('should reject events with undfined first arg', function () {
    api.recordCustomEvent(undefined, {alpha: 'beta'})
    expect(popTopCustomEvent(agent)).to.not.exist
  })

  it('should reject events with null first arg', function () {
    api.recordCustomEvent(null, {alpha: 'beta'})
    expect(popTopCustomEvent(agent)).to.not.exist
  })

  it('should reject events with string second arg', function () {
    api.recordCustomEvent('EventThing', 'thing')
    expect(popTopCustomEvent(agent)).to.not.exist
  })

  it('should reject events with array second arg', function () {
    api.recordCustomEvent('EventThing', [])
    expect(popTopCustomEvent(agent)).to.not.exist
  })

  it('should reject events with number second arg', function () {
    api.recordCustomEvent('EventThing', 1)
    expect(popTopCustomEvent(agent)).to.not.exist
  })

  it('should reject events with undefined second arg', function () {
    api.recordCustomEvent('EventThing', undefined)
    expect(popTopCustomEvent(agent)).to.not.exist
  })

  it('should reject events with null second arg', function () {
    api.recordCustomEvent('EventThing', null)
    expect(popTopCustomEvent(agent)).to.not.exist
  })

  it('should reject events with a type greater than 255 chars', function () {
    var badType = new Array(257).join('a')
    api.recordCustomEvent(badType, {ship: 'every week'})
    expect(popTopCustomEvent(agent)).to.not.exist
  })

  it('should reject events with an attribute key greater than 255 chars', function () {
    var badKey = new Array(257).join('b')
    var attributes = {}
    attributes[badKey] = true
    api.recordCustomEvent('MyType', attributes)
    expect(popTopCustomEvent(agent)).to.not.exist
  })
})

function popTopCustomEvent(agent) {
  return agent.customEvents.toArray().pop()
}