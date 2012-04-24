var should  = require('should')
  , logger  = require('../lib/logger')
  , trace   = require('../lib/trace')
  , util    = require('util')
  ;

describe('execution tracing', function () {
  before(function (done) {
    logger.logToConsole(false);

    return done();
  });

  it('should accurately return a raw stacktrace', function (done) {
    var stack = trace.getRawStack();
    // nothing like a hardcoded assumption about how the test is being run. Mmmm.
    stack[1].receiver.type.should.equal('test');

    return done();
  });

  describe('within the tracer', function () {
    var agent
      , transaction
      , teststamp
      ;

    function teststamper() {
      return teststamp;
    }

    before(function (done) {
      teststamp = Date.now();

      return done();
    });

    beforeEach(function (done) {
      agent = require('./lib/test_agent').createAgent();
      transaction = trace.createTransaction(agent);
      logger.logToConsole(false);

      return done();
    });

    it('should insert a trace into the stats traced by the agent', function (done) {
      var tracer = new trace.Tracer(transaction, 'Custom/Test');
      tracer.getStartTime = tracer.getEndTime = teststamper;
      tracer.finish();
      agent.transactions.length.should.equal(1);

      var stats = agent.transactions[0].getScopedStats().getStats('Custom/Test');
      JSON.stringify(stats).should.equal('[1,0,0,0,0,0]', 'should only have one invocation of the test trace');

      return done();
    });

    it('should only insert a single trace per transaction', function (done) {
      var tracer = new trace.Tracer(transaction, 'Custom/Test2');
      tracer.getStartTime = tracer.getEndTime = teststamper;
      tracer.finish();
      agent.transactions.length.should.equal(1);

      tracer = new trace.Tracer(transaction, 'Custom/Test3');
      tracer.getStartTime = tracer.getEndTime = teststamper;
      tracer.finish();
      agent.transactions.length.should.equal(1);

      var stats = agent.transactions[0].getScopedStats();
      var data = JSON.stringify(stats.getMetricData());
      JSON.stringify(stats.getMetricData()).should.equal('[[{"name":"Custom/Test2"},[1,0,0,0,0,0]]]');

      return done();
    });
  });
});
