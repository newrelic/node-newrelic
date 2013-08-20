'use strict';

var path        = require('path')
  , chai        = require('chai')
  , expect      = chai.expect
  , helper      = require(path.join(__dirname, 'lib', 'agent_helper'))
  , web         = require(path.join(__dirname, '..', 'lib', 'transaction', 'web'))
  , recordRedis = require(path.join(__dirname, '..', 'lib', 'metrics',
                                    'recorders', 'redis'))
  , Transaction = require(path.join(__dirname, '..', 'lib', 'transaction'))
  ;

function makeSegment(options) {
  var segment = options.transaction.getTrace().root.add('Redis/set');
  segment.setDurationInMillis(options.duration);
  segment._setExclusiveDurationInMillis(options.exclusive);

  return segment;
}

function record(options) {
  if (options.apdexT) options.transaction.metrics.apdexT = options.apdexT;

  var segment = makeSegment(options)
    , root    = options.transaction.getTrace().root
    ;

  web.normalizeAndName(root, options.url, options.code);
  recordRedis(segment, options.transaction.scope);
}

describe("recordRedis", function () {
  var agent
    , trans
    ;

  beforeEach(function () {
    agent = helper.loadMockedAgent();
    trans = new Transaction(agent);
  });

  afterEach(function () {
    helper.unloadAgent(agent);
  });

  describe("when scope is undefined", function () {
    var segment;

    beforeEach(function () {
      segment = makeSegment({
        transaction : trans,
        duration : 0,
        exclusive : 0
      });
    });

    it("shouldn't crash on recording", function () {
      expect(function () { recordRedis(segment, undefined); }).not.throws();
    });

    it("should record no scoped metrics", function () {
      recordRedis(segment, undefined);

      var result = [
        [{name : "Redis/set"},      [1,0,0,0,0,0]],
        [{name : "Redis/allOther"}, [1,0,0,0,0,0]],
        [{name : "Redis/all"},      [1,0,0,0,0,0]]
      ];

      expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result));
    });
  });

  describe("with scope", function () {
    it("should record scoped metrics", function () {
      record({
        transaction : trans,
        url : '/test',
        code : 200,
        apdexT : 10,
        duration : 26,
        exclusive : 2,
      });

      var result = [
        [{name  : "Redis/set"},               [1,0.026,0.002,0.026,0.026,0.000676]],
        [{name  : "Redis/allWeb"},            [1,0.026,0.002,0.026,0.026,0.000676]],
        [{name  : "Redis/all"},               [1,0.026,0.002,0.026,0.026,0.000676]],
        [{name  : "Redis/set",
          scope : "WebTransaction/Uri/test"}, [1,0.026,0.002,0.026,0.026,0.000676]]
      ];

      expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result));
    });
  });

  it("should report exclusive time correctly", function () {
    var root   = trans.getTrace().root
      , parent = root.add('Redis/ladd',     recordRedis)
      , child1 = parent.add('Redis/blpopr', recordRedis)
      , child2 = child1.add('Redis/lpop',   recordRedis)
      ;

    root.setDurationInMillis(26, 0);
    parent.setDurationInMillis(26, 0);
    child1.setDurationInMillis(12, 3);
    child2.setDurationInMillis(8, 11);

    trans.end();

    var result = [
      [{name : "Redis/ladd"},     [1,0.026,0.014,0.026,0.026,0.000676]],
      [{name : "Redis/allOther"}, [3,0.046,0.030,0.008,0.026,0.000884]],
      [{name : "Redis/all"},      [3,0.046,0.030,0.008,0.026,0.000884]],
      [{name : "Redis/blpopr"},   [1,0.012,0.008,0.012,0.012,0.000144]],
      [{name : "Redis/lpop"},     [1,0.008,0.008,0.008,0.008,0.000064]]
    ];

    expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result));
  });
});
