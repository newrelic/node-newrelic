'use strict';

var path         = require('path')
  , helper       = require(path.join(__dirname, 'lib', 'agent_helper.js'))
  , chai         = require('chai')
  , expect       = chai.expect
  , Transaction  = require(path.join(__dirname, '..', 'lib', 'transaction.js'))
  ;


describe("when analytics events are disabled", function () {
  var agent;

  beforeEach(function () {
    agent = helper.loadMockedAgent();
  });

  afterEach(function () {
    helper.unloadAgent(agent);
  });

  it("should not send events to server", function (done) {
    agent.collector.analyticsEvents = function () {
      throw new Error(); // FAIL
    };
    agent.config.analytics_events.enabled = false;
    agent._sendEvents(function () {
      done();
    });
  });
});

describe("on transaction finished", function () {
  var agent;

  beforeEach(function () {
    agent = helper.loadMockedAgent();

    // FLAG: insights
    agent.config.feature_flag.insights = true;
  });

  afterEach(function () {
    helper.unloadAgent(agent);
  });

  it("should queue an event", function (done) {
    var trans = new Transaction(agent);

    agent._addEventFromTransaction = function (transaction) {
      expect(transaction).to.equal(trans);
      done();
    };

    trans.end();
  });

  it("should generate an event from transaction", function () {
    var trans = new Transaction(agent);

    trans.end();

    expect(agent.events.length).to.equal(1);

    var event = agent.events[0];
    expect(event).to.be.a('Array');
    expect(event[0]).to.be.a('object');
    expect(event[0].webDuration).to.be.a('number');
    expect(event[0].webDuration).to.equal(trans.timer.duration);
    expect(event[0].timestamp).to.be.a('number');
    expect(event[0].timestamp).to.equal(trans.timer.start);
    expect(event[0].name).to.equal(trans.name);
    expect(event[0].duration).to.equal(trans.timer.duration);
    expect(event[0].type).to.equal('Transaction');
  });

  it("should contain custom parameters", function () {
    var trans = new Transaction(agent);

    trans.getTrace().custom['a'] = 'b';
    trans.end();

    var event = agent.events[0];

    expect(event[1].a).equals('b');

  });
});
