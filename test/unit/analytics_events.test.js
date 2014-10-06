'use strict'
/*jshint expr:true*/

var path         = require('path')
  , helper       = require('../lib/agent_helper.js')
  , chai         = require('chai')
  , expect       = chai.expect
  , Transaction  = require('../../lib/transaction.js')
  

describe("when there are parameters on transaction", function () {
  var agent
    , trans
    

  beforeEach(function () {
    agent = helper.loadMockedAgent()
    trans = new Transaction(agent)
  })

  afterEach(function () {
    helper.unloadAgent(agent)
  })

  it("event should contain those parameters", function (){
    var par = trans.getTrace().parameters
    par['test'] = 'TEST'
    agent._addEventFromTransaction(trans)

    var first = 0
    var agentAttrs = 2
    expect(agent.events.toArray()[first][agentAttrs].test).equals('TEST')
  })

})

describe("when analytics events are disabled", function () {
  var agent

  beforeEach(function () {
    agent = helper.loadMockedAgent()
  })

  afterEach(function () {
    helper.unloadAgent(agent)
  })

  it("should not send events to server", function (done) {
    agent.collector.analyticsEvents = function () {
      throw new Error(); // FAIL
    }
    agent.config.transaction_events.enabled = false
    agent._sendEvents(function cb__sendEvents() {
      done()
    })
  })

  it("collector cannot enable remotely", function () {
    agent.config.transaction_events.enabled = false
    expect(function () {
      agent.config.onConnect({'collect_analytics_events' : true})
    }).not.throws()
    expect(agent.config.transaction_events.enabled).equals(false)
  })

})

describe("when analytics events are enabled", function () {
  var agent

  beforeEach(function () {
    agent = helper.loadMockedAgent()
  })

  afterEach(function () {
    helper.unloadAgent(agent)
  })

  it("collector can disable remotely", function () {
    agent.config.transaction_events.enabled = true
    expect(function () {
      agent.config.onConnect({'collect_analytics_events' : false})
    }).not.throws()
    expect(agent.config.transaction_events.enabled).equals(false)
  })
})

describe("on transaction finished", function () {
  var agent

  beforeEach(function () {
    agent = helper.loadMockedAgent()
  })

  afterEach(function () {
    helper.unloadAgent(agent)
  })

  it("should queue an event", function (done) {
    var trans = new Transaction(agent)

    agent._addEventFromTransaction = function (transaction) {
      expect(transaction).to.equal(trans)
      done()
    }

    trans.end()
  })

  it("should generate an event from transaction", function () {
    var trans = new Transaction(agent)

    trans.end()

    expect(agent.events.toArray().length).to.equal(1)

    var event = agent.events.toArray()[0]
    expect(event).to.be.a('Array')
    expect(event[0]).to.be.a('object')
    expect(event[0].webDuration).to.be.a('number')
    expect(event[0].webDuration).to.equal(trans.timer.duration)
    expect(event[0].timestamp).to.be.a('number')
    expect(event[0].timestamp).to.equal(trans.timer.start)
    expect(event[0].name).to.equal(trans.name)
    expect(event[0].duration).to.equal(trans.timer.duration)
    expect(event[0].type).to.equal('Transaction')
  })

  it("should contain user and agent attirbutes", function () {
    var trans = new Transaction(agent)

    trans.end()

    expect(agent.events.toArray().length).to.equal(1)

    var event = agent.events.toArray()[0]
    expect(event[0]).to.be.a('Object')
    expect(event[1]).to.be.a('Object')
    expect(event[2]).to.be.a('Object')
  })

  it("should contain custom parameters", function () {
    var trans = new Transaction(agent)

    trans.getTrace().custom['a'] = 'b'
    trans.end()

    var event = agent.events.toArray()[0]

    expect(event[1].a).equals('b')

  })

  it("not spill over reservoir size", function () {
    var trans = new Transaction(agent)
    agent.events.limit = 10

    for (var i=0; i<20; i++)
      agent._addEventFromTransaction(trans)

    expect(agent.events.toArray().length).equals(10)
  })

  it("re-aggregate on failure", function (done) {
    agent.collector.analyticsEvents = function(payload,cb){
      cb(true)
    }

    var trans = new Transaction(agent)
    for (var i=0; i<20; i++)
      agent._addEventFromTransaction(trans)

    agent._sendEvents(function(err){
      expect(err).exists
      expect(agent.events.toArray().length).equals(20)
      done()
    })
  })

  it("empty on success", function (done) {
    agent.collector.analyticsEvents = function(payload,cb){
      cb()
    }

    var trans = new Transaction(agent)
    for (var i=0; i<20; i++)
      agent._addEventFromTransaction(trans)

    agent._sendEvents(function(err){
      expect(err).not.exists
      expect(agent.events.toArray().length).equals(0)
      done()
    })
  })

  it("empty on 413", function (done) {
    agent.collector.analyticsEvents = function(payload,cb){
      cb({statusCode: 413})
    }

    var trans = new Transaction(agent)
    for (var i=0; i<20; i++)
      agent._addEventFromTransaction(trans)

    agent._sendEvents(function(err){
      expect(err).not.exists
      expect(agent.events.toArray().length).equals(0)
      done()
    })
  })

})
