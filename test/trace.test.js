'use strict';

var path        = require('path')
  , chai        = require('chai')
  , expect      = chai.expect
  , helper      = require(path.join(__dirname, 'lib', 'agent_helper'))
  , codec       = require(path.join(__dirname, '..', 'lib', 'util', 'codec'))
  , Segment     = require(path.join(__dirname, '..', 'lib', 'transaction', 'trace', 'segment'))
  , Trace       = require(path.join(__dirname, '..', 'lib', 'transaction', 'trace'))
  , Transaction = require(path.join(__dirname, '..', 'lib', 'transaction'))
  ;

describe('Trace', function () {
  var agent;

  beforeEach(function () {
    agent = helper.loadMockedAgent();
  });

  afterEach(function () {
    helper.unloadAgent(agent);
  });

  it("should always be bound to a transaction", function () {
    // fail
    expect(function () {
      var transam = new Trace();
    }).throws(/must be associated with a transaction/);

    // succeed
    var tt = new Trace(new Transaction(agent));
    expect(tt.transaction).instanceof(Transaction);
  });

  it("should have the root of a Segment tree", function () {
    var tt = new Trace(new Transaction(agent));
    expect(tt.root).instanceof(Segment);
  });

  it("should be the primary interface for adding segments to a trace", function () {
    var trace = new Trace(new Transaction(agent));
    expect(function () { trace.add('Custom/Test17/Child1'); }).not.throws();
  });

  it("should produce a transaction trace in the collector's expected format", function (done) {
    var DURATION = 33;
    var URL = '/test?test=value';

    var transaction = new Transaction(agent);
    transaction.measureWeb(URL, 200, DURATION);

    var trace = transaction.getTrace();
    var start = trace.root.timer.start;
    expect(start, "root segment's start time").above(0);
    trace.root.timer.setDurationInMillis(DURATION, 0);

    var web = trace.addWeb(URL);
    // top-level element will share a duration with the quasi-ROOT node
    web.setDurationInMillis(DURATION, 0);

    var db = web.add('DB/select/getSome');
    db.setDurationInMillis(14, 3);

    var memcache = web.add('Memcache/lookup/user/13');
    memcache.setDurationInMillis(20, 8);

    /*
     * Segment data repeats the outermost data, nested, with the scope for the
     * outermost version having its scope always set to "ROOT". The null bits
     * are parameters, which are optional, and so far, unimplemented for Node.
     */
    var rootSegment = [
      0,
      DURATION,
      'ROOT',
      {},
      [
        [
          0,
          DURATION,
          'WebTransaction/Uri/test',
          {test : 'value'},
          [
            // TODO: ensure that the ordering is correct WRT start time
            db.toJSON(),
            memcache.toJSON()
          ]
        ]
      ]
    ];

    var rootNode = [
      trace.root.timer.start / 1000,
      {test : "value"},
      {}, // FIXME: custom parameters
      rootSegment,
      []  // FIXME: parameter groups
    ];

    codec.encode(rootNode, function (err, encoded) {
      if (err) return done(err);

      // See docs on Transaction.generateJSON for what goes in which field.
      var expected = [
        start,
        DURATION,
        'WebTransaction/Uri/test',  // scope
        '/test',                    // URI path
        encoded, // compressed segment / segment data
        '',                         // FIXME: depends on RUM token in session
        null,                       // reserved, always NULL
        false                       // FIXME: RUM2 session persistence, not
                                    //        worrying about it for now
      ];

      transaction.getTrace().generateJSON(function (err, traceJSON) {
        if (err) return done(err);

        codec.decode(traceJSON[4], function (derr, reconstituted) {
          if (derr) return done(derr);

          expect(reconstituted, "reconstituted trace segments").deep.equal(rootNode);
          expect(traceJSON,     "full trace JSON").deep.equal(expected);

          helper.unloadAgent(agent);
          return done();
        });
      });
    });
  });

  it("should produce human-readable JSON of the entire trace graph");

  describe("when inserting segments", function () {
    var trace;

    beforeEach(function () {
      trace = new Trace(new Transaction(agent));
    });

    it("should require a name for the new segment", function () {
      expect(function () { trace.add(); }).throws(/must be named/);
    });

    it("should allow child segments on a trace", function () {
      expect(function () { trace.add('Custom/Test17/Child1'); }).not.throws();
    });

    it("should return the segment", function () {
      var segment;
      expect(function () { segment = trace.add('Custom/Test18/Child1'); }).not.throws();
      expect(segment).instanceof(Segment);
    });

    it("should call a callback associated with the segment at creation time", function (done) {
      var segment;
      segment = trace.add('Custom/Test18/Child1', function () {
        return done();
      });

      segment.end();
    });

    it("should measure exclusive time vs total time at each level of the graph", function () {
      var child = trace.add('Custom/Test18/Child1');

      trace.setDurationInMillis(42);
      child.setDurationInMillis(22, 0);

      expect(trace.getExclusiveDurationInMillis()).equal(20);
    });

    it("should accurately sum overlapping segments", function () {
      trace.setDurationInMillis(42);

      var now = Date.now();

      var child1 = trace.add('Custom/Test19/Child1');
      child1.setDurationInMillis(22, now);

      // add another child trace completely encompassed by the first
      var child2 = trace.add('Custom/Test19/Child2');
      child2.setDurationInMillis(5, now + 5);

      // add another that starts within the first range but that extends beyond
      var child3 = trace.add('Custom/Test19/Child3');
      child3.setDurationInMillis(22, now + 11);

      // add a final child that's entirely disjoint
      var child4 = trace.add('Custom/Test19/Child4');
      child4.setDurationInMillis(4, now + 35);

      expect(trace.getExclusiveDurationInMillis()).equal(5);
    });

    it("should accurately sum partially overlapping segments", function () {
      trace.setDurationInMillis(42);

      var now = Date.now();

      var child1 = trace.add('Custom/Test20/Child1');
      child1.setDurationInMillis(22, now);

      // add another child trace completely encompassed by the first
      var child2 = trace.add('Custom/Test20/Child2');
      child2.setDurationInMillis(5, now + 5);

      // add another that starts simultaneously with the first range but that extends beyond
      var child3 = trace.add('Custom/Test20/Child3');
      child3.setDurationInMillis(33, now);

      expect(trace.getExclusiveDurationInMillis()).equal(9);
    });

    it("should accurately sum partially overlapping, open-ranged segments", function () {
      trace.setDurationInMillis(42);

      var now = Date.now();

      var child1 = trace.add('Custom/Test21/Child1');
      child1.setDurationInMillis(22, now);

      // add a range that starts at the exact end of the first
      var child2 = trace.add('Custom/Test21/Child2');
      child2.setDurationInMillis(11, now + 22);

      expect(trace.getExclusiveDurationInMillis()).equal(9);
    });
  });
});
