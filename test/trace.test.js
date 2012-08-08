'use strict';

var path    = require('path')
  , chai    = require('chai')
  , should  = chai.should()
  , trace   = require(path.join(__dirname, '..', 'lib', 'trace'))
  ;

describe('execution tracing', function () {
  describe('working with raw timers', function () {
    it('should have a start defined on instantiation', function (done) {
      var timer = new trace.Timer();
      should.exist(timer.start);

      return done();
    });

    it('should not have a end defined on instantiation', function (done) {
      var timer = new trace.Timer();
      should.not.exist(timer.end);

      return done();
    });
  });

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
      agent = require('./lib/stub_agent').createAgent();
      transaction = trace.createTransaction(agent);

      return done();
    });

    it('should insert a trace into the stats traced by the agent', function (done) {
      var tracer = new trace.Tracer(transaction, 'Custom/Test');
      tracer.getDurationInMillis = stubDuration;
      tracer.finish();
      agent.transactions.length.should.equal(1);

      var stats = agent.transactions[0].scopedStats.byName('Custom/Test');
      JSON.stringify(stats).should.equal('[1,0,0,0,0,0]', 'should only have one invocation of the test trace');

      return done();
    });

    it('should only insert a single trace per transaction', function (done) {
      var tracer = new trace.Tracer(transaction, 'Custom/Test2');
      tracer.getDurationInMillis = stubDuration;
      tracer.finish();
      agent.transactions.length.should.equal(1);

      tracer = new trace.Tracer(transaction, 'Custom/Test3');
      tracer.getDurationInMillis = stubDuration;
      tracer.finish();
      agent.transactions.length.should.equal(1);

      var stats = agent.transactions[0].scopedStats;
      JSON.stringify(stats.getMetricData()).should.equal('[[{"name":"Custom/Test2"},[1,0,0,0,0,0]]]');

      return done();
    });
  });
});
