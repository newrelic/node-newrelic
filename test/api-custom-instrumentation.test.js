'use strict';

var path   = require('path')
  , expect = require('chai').expect
  , helper = require(path.join(__dirname, 'lib', 'agent_helper.js'))
  , API    = require(path.join(__dirname, '..', 'api.js'))
  ;

describe('The custom instrumentation API', function () {
  var agent;
  var api;

  beforeEach(function () {
    // FLAG: custom_instrumentation
    agent = helper.loadMockedAgent({custom_instrumentation: true});
    api = new API(agent);
  });

  afterEach(function () {
    helper.unloadAgent(agent);
  });

  describe('when creating a segment', function () {
    it('should work in a clean transaction', function (done) {
      agent.on('transactionFinished', function (transaction) {
        var trace = transaction.getTrace();
        expect(trace).to.exist;
        expect(trace.root.children).to.have.length(1);
        var segment = trace.root.children[0];
        expect(segment.name).to.equal('custom:segment');
        done();
      });

      helper.runInTransaction(agent, function (transaction) {
        var markedFunction = api.createSegment('custom:segment', function () {
          transaction.end();
        });
        markedFunction();
      });
    });

    it('should work nested in a segment', function (done) {
      agent.on('transactionFinished', function (transaction) {
        var trace = transaction.getTrace();
        expect(trace).to.exist;
        expect(trace.root.children).to.have.length(1);
        var parentSegment = trace.root.children[0];
        expect(parentSegment.name).to.equal('parent');
        expect(parentSegment.children).to.have.length(1);
        var customSegment = parentSegment.children[0];
        expect(customSegment.name).to.equal('custom:segment');
        done();
      });

      helper.runInTransaction(agent, function (transaction) {
        agent.tracer.addSegment('parent');
        var markedFunction = api.createSegment('custom:segment', function () {
          transaction.end();
        });
        markedFunction();
      });
    });

    it('should work with a segment nested in it', function (done) {
      agent.on('transactionFinished', function (transaction) {
        var trace = transaction.getTrace();
        expect(trace).to.exist;
        expect(trace.root.children).to.have.length(1);
        var customSegment = trace.root.children[0];
        expect(customSegment.name).to.equal('custom:segment');
        expect(customSegment.children).to.have.length(1);
        var childSegment = customSegment.children[0];
        expect(childSegment.name).to.equal('child');
        done();
      });

      helper.runInTransaction(agent, function (transaction) {
        var markedFunction = api.createSegment('custom:segment', function () {
          agent.tracer.addSegment('child');
          transaction.end();
        });
        markedFunction();
      });
    });
  });
  // FLAG: custom_instrumentation
  it('should not cause problems when feature flag is disabled', function (done) {
    agent.config.feature_flag.custom_instrumentation = false;

    agent.on('transactionFinished', function (transaction) {
      var trace = transaction.getTrace();
      expect(trace).to.exist;
      expect(trace.root.children).to.have.length(0);
      done();
    });

    helper.runInTransaction(agent, function (transaction) {
      var markedFunction = api.createSegment('custom:segment', function () {
        transaction.end();
      });
      markedFunction();
    });
  });
});