'use strict';

var path         = require('path')
  , chai         = require('chai')
  , should       = chai.should()
  , trace        = require(path.join(__dirname, '..', 'lib', 'trace'))
  , helper       = require(path.join(__dirname, 'lib', 'agent_helper'))
  , Tracer       = require(path.join(__dirname, '..', 'lib', 'trace-legacy', 'tracer'))
  ;

describe('execution tracing', function () {
  describe('within the tracer', function () {
    var agent
      , transaction
      , teststamp
      ;

    function stubDuration () {
      return 0;
    }

    before(function () {
      teststamp = Date.now();
    });

    beforeEach(function (done) {
      agent = helper.loadMockedAgent();
      transaction = trace.createTransaction(agent);

      return done();
    });

    afterEach(function () {
      agent.stop();
    });

    it('should insert a trace into the stats traced by the agent', function () {
      var tracer = new Tracer(transaction, 'Custom/Test');
      tracer.getDurationInMillis = stubDuration;
      tracer.finish();

      var stats = agent.metrics.getOrCreateMetric('Custom/Test').stats;
      stats.callCount.should.equal(1);
    });

    it('should only insert a single trace per transaction', function () {
      var tracer = new Tracer(transaction, 'Custom/Test2');
      tracer.getDurationInMillis = stubDuration;
      tracer.finish();

      tracer = new Tracer(transaction, 'Custom/Test3');
      tracer.getDurationInMillis = stubDuration;
      tracer.finish();

      var stats = agent.metrics.getOrCreateMetric('Custom/Test2').stats;
      stats.callCount.should.equal(1);
    });
  });
});
