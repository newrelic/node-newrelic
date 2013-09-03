'use strict';

var path         = require('path')
  , chai         = require('chai')
  , should       = chai.should()
  , expect       = chai.expect
  , helper       = require(path.join(__dirname, 'lib', 'agent_helper'))
  , TraceSegment = require(path.join(__dirname, '..', 'lib', 'transaction',
                                     'trace', 'segment'))
  , Trace        = require(path.join(__dirname, '..', 'lib', 'transaction', 'trace'))
  , Transaction  = require(path.join(__dirname, '..', 'lib', 'transaction'))
  ;

describe("TraceSegment", function () {
  it("should be bound to a Trace", function () {
    var segment;
    expect(function noTrace() {
      segment = new TraceSegment(null, 'UnitTest');
    }).throws();

    var success = new TraceSegment(new Trace('Test/TraceExample07'), 'UnitTest');
    expect(success.trace).instanceof(Trace);
  });

  it("should call an optional callback function", function (done) {
    var segment;
    expect(function noCallback() {
      segment = new TraceSegment(new Trace('Test/TraceExample08'), 'UnitTest');
    }).not.throws();

    function callback() {
      helper.unloadAgent(agent);
      return done();
    }

    var agent   = helper.loadMockedAgent()
      , trans   = new Transaction(agent)
      , working = new TraceSegment(trans.getTrace(), 'UnitTest', callback)
      ;

    working.end();
    trans.end();
  });

  it("has a name", function () {
    var segment;
    expect(function noName() {
      segment = new TraceSegment(new Trace('Test/TraceExample06'));
    }).throws();
    var success = new TraceSegment(new Trace('Test/TraceExample07'), 'UnitTest');
    expect(success.name).equal('UnitTest');
  });

  it("is created with no children", function () {
    var segment = new TraceSegment(new Trace('Test/TraceExample02'), 'UnitTest');
    expect(segment.children.length).equal(0);
  });

  it("has a timer", function () {
    var segment = new TraceSegment(new Trace('Test/TraceExample03'), 'UnitTest');
    should.exist(segment.timer);
  });

  it("starts its timer on creation", function () {
    var segment = new TraceSegment(new Trace('Test/TraceExample03'), 'UnitTest');
    expect(segment.timer.isRunning()).equal(true);
  });

  it("accepts a callback that records metrics associated with this segment",
     function (done) {
    var agent   = helper.loadMockedAgent()
      , trans   = new Transaction(agent)
      , segment = new TraceSegment(trans.getTrace(), 'Test', function (insider) {
      expect(insider).equal(segment);
      helper.unloadAgent(agent);
      return done();
    });

    segment.end();
    trans.end();
  });

  describe("with children created from URLs", function () {
    var webChild, agent;

    before(function () {
      agent = helper.loadMockedAgent();
      agent.config.capture_params = true;

      var transaction = new Transaction(agent)
        , trace       = new Trace(transaction)
        , segment     = new TraceSegment(trace, 'UnitTest')
        , url         = '/test?test1=value1&test2&test3=50&test4='
        ;

      webChild = segment.add(url);
      transaction.setName(url, 200);
      webChild.markAsWeb(url);

      trace.setDurationInMillis(1, 0);
      webChild.setDurationInMillis(1, 0);
    });

    after(function () {
      helper.unloadAgent(agent);
    });

    it("should return the URL minus any query parameters", function () {
      expect(webChild.name).equal('WebTransaction/NormalizedUri/*');
    });

    it("should have parameters on the child segment", function () {
      should.exist(webChild.parameters);
    });

    it("should have the parameters that were passed in the query string", function () {
      expect(webChild.parameters.test1).equal('value1');
      expect(webChild.parameters.test3).equal('50');
    });

    it("should set bare parameters to true (as in present)", function () {
      expect(webChild.parameters.test2).equal(true);
    });

    it("should set parameters with empty values to ''", function () {
      expect(webChild.parameters.test4).equal('');
    });

    it("should serialize the segment with the parameters", function () {
      var expected = [
        0,
        1,
        'WebTransaction/NormalizedUri/*',
        {
          nr_exclusive_duration_millis : 1,
          test1 : 'value1',
          test2 : true,
          test3 : '50',
          test4 : ''
        },
        []
      ];
      expect(webChild.toJSON()).deep.equal(expected);
    });
  });

  describe("with parameters parsed out by framework", function () {
    var webChild, agent;

    before(function () {
      agent = helper.loadMockedAgent();
      agent.config.capture_params = true;

      var transaction = new Transaction(agent)
        , trace       = new Trace(transaction)
        , segment     = new TraceSegment(trace, 'UnitTest')
        , url         = '/test'
        , params;

      // Express uses positional parameters sometimes
      params = ['first', 'another'];
      params.test3 = '50';

      webChild = segment.add(url);
      transaction.setName(url, 200);
      webChild.markAsWeb(url, params);

      trace.setDurationInMillis(1, 0);
      webChild.setDurationInMillis(1, 0);
    });

    after(function () {
      helper.unloadAgent(agent);
    });

    it("should return the URL minus any query parameters", function () {
      expect(webChild.name).equal('WebTransaction/NormalizedUri/*');
    });

    it("should have parameters on the child segment", function () {
      should.exist(webChild.parameters);
    });

    it("should have the positional parameters from the params array", function () {
      expect(webChild.parameters[0]).equal('first');
      expect(webChild.parameters[1]).equal('another');
    });

    it("should have the named parameter from the params array", function () {
      expect(webChild.parameters.test3).equal('50');
    });

    it("should serialize the segment with the parameters", function () {
      var expected = [
        0,
        1,
        'WebTransaction/NormalizedUri/*',
        {
          nr_exclusive_duration_millis : 1,
          0     : 'first',
          1     : 'another',
          test3 : '50',
        },
        []
      ];
      expect(webChild.toJSON()).deep.equal(expected);
    });
  });

  describe("with capture_params disabled", function () {
    var webChild, agent;

    before(function () {
      agent = helper.loadMockedAgent();
      agent.config.capture_params = false;

      var transaction = new Transaction(agent)
        , trace       = new Trace(transaction)
        , segment     = new TraceSegment(trace, 'UnitTest')
        , url         = '/test?test1=value1&test2&test3=50&test4='
        ;

      webChild = segment.add(url);
      transaction.setName(url, 200);
      webChild.markAsWeb(url);

      trace.setDurationInMillis(1, 0);
      webChild.setDurationInMillis(1, 0);
    });

    after(function () {
      helper.unloadAgent(agent);
    });

    it("should return the URL minus any query parameters", function () {
      expect(webChild.name).equal('WebTransaction/NormalizedUri/*');
    });

    it("should have parameters on the child segment", function () {
      expect(webChild.parameters).eql({nr_exclusive_duration_millis : null});
    });

    it("should serialize the segment without the parameters", function () {
      var expected = [
        0,
        1,
        'WebTransaction/NormalizedUri/*',
        {nr_exclusive_duration_millis : 1},
        []
      ];
      expect(webChild.toJSON()).deep.equal(expected);
    });
  });

  describe("with capture_params enabled and ignored_params set", function () {
    var webChild, agent;

    before(function () {
      agent = helper.loadMockedAgent();
      agent.config.capture_params = true;
      agent.config.ignored_params = ['test1', 'test4'];

      var transaction = new Transaction(agent)
        , trace       = new Trace(transaction)
        , segment     = new TraceSegment(trace, 'UnitTest')
        , url         = '/test?test1=value1&test2&test3=50&test4='
        ;

      webChild = segment.add(url);
      transaction.setName(url, 200);
      webChild.markAsWeb(url);

      trace.setDurationInMillis(1, 0);
      webChild.setDurationInMillis(1, 0);
    });

    after(function () {
      helper.unloadAgent(agent);
    });

    it("should return the URL minus any query parameters", function () {
      expect(webChild.name).equal('WebTransaction/NormalizedUri/*');
    });

    it("should have parameters on the child segment", function () {
      should.exist(webChild.parameters);
    });

    it("should have filtered the parameters that were passed in the query string",
       function () {
      should.not.exist(webChild.parameters.test1);
      expect(webChild.parameters.test3).equal('50');
    });

    it("should set bare parameters to true (as in present)", function () {
      expect(webChild.parameters.test2).equal(true);
    });

    it("should not have filtered parameter", function () {
      should.not.exist(webChild.parameters.test4);
    });

    it("should serialize the segment with the parameters", function () {
      var expected = [
        0,
        1,
        'WebTransaction/NormalizedUri/*',
        {
          nr_exclusive_duration_millis : 1,
          test2 : true,
          test3 : '50'
        },
        []
      ];
      expect(webChild.toJSON()).deep.equal(expected);
    });
  });

  it("should retain any associated SQL statements");
  it("should allow an arbitrary number of segments in the scope of this segment");

  describe("when ended", function () {
    it("stops its timer", function () {
      var segment = new TraceSegment(new Trace('Test/TraceExample04'), 'UnitTest');
      segment.end();
      expect(segment.timer.isRunning()).equal(false);
    });

    it("knows its exclusive duration");
    it("produces human-readable JSON");

    it("should produce JSON that conforms to the collector spec", function () {
      var trace = new Trace('WebTransaction/NormalizedUri/*');
      var segment = new TraceSegment(trace, 'DB/select/getSome');

      trace.setDurationInMillis(17, 0);
      segment.setDurationInMillis(14, 3);
      // See documentation on TraceSegment.toJSON for what goes in which field.
      expect(segment.toJSON()).deep.equal([3,
                                           17,
                                           'DB/select/getSome',
                                           {nr_exclusive_duration_millis : 14},
                                           []]);
    });
  });
});
