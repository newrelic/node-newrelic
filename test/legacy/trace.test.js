'use strict';

var path         = require('path')
  , chai         = require('chai')
  , should       = chai.should()
  , trace        = require(path.join(__dirname, '..', 'lib', 'legacy', 'trace'))
  , helper       = require(path.join(__dirname, 'lib', 'agent_helper'))
  , Tracer       = require(path.join(__dirname, '..', 'lib', 'legacy', 'tracer'))
  ;

describe('execution tracing', function () {
  describe('within the tracer', function () {
    var agent
      , transaction
      ;

    before(function () {
      agent = helper.loadMockedAgent();
    });

    beforeEach(function () {
      transaction = trace.createTransaction(agent);
    });

    after(function () {
      helper.unloadAgent(agent);
    });

    it('should insert a trace into the stats traced by the agent', function () {
      var tracer = new Tracer(transaction, 'Custom/Test');
      tracer.finish();

      var stats = agent.metrics.getOrCreateMetric('Custom/Test', 'FIXME').stats;
      stats.callCount.should.equal(1);
    });

    it('should only insert a single trace per transaction', function () {
      var tracer = new Tracer(transaction, 'Custom/Test2');
      tracer.finish();

      tracer = new Tracer(transaction, 'Custom/Test3');
      tracer.finish();

      var stats = agent.metrics.getOrCreateMetric('Custom/Test2', 'FIXME').stats;
      stats.callCount.should.equal(1);
    });
  });
});
