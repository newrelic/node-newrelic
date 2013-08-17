'use strict';

var path            = require('path')
  , chai            = require('chai')
  , expect          = chai.expect
  , helper          = require(path.join(__dirname, 'lib', 'agent_helper'))
  , web             = require(path.join(__dirname, '..', 'lib', 'transaction', 'web'))
  , recordMemcached = require(path.join(__dirname, '..', 'lib', 'metrics',
                                        'recorders', 'memcached'))
  , Transaction     = require(path.join(__dirname, '..', 'lib', 'transaction'))
  ;

function makeSegment(options) {
  var segment = options.transaction.getTrace().root.add('MemCache/set');
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
  recordMemcached(segment, options.transaction.scope);
}

describe("recordMemcached", function () {
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
      expect(function () { recordMemcached(segment, undefined); }).not.throws();
    });

    it("should record no scoped metrics", function () {
      recordMemcached(segment, undefined);

      var result = [
        [{name : "MemCache/set"},    [1,0,0,0,0,0]],
        [{name : "MemCache/all"},    [1,0,0,0,0,0]],
        [{name : "MemCache/allWeb"}, [1,0,0,0,0,0]]
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
        [{name  : "MemCache/set"},            [1,0.026,0.002,0.026,0.026,0.000676]],
        [{name  : "MemCache/all"},            [1,0.026,0.002,0.026,0.026,0.000676]],
        [{name  : "MemCache/allWeb"},         [1,0.026,0.002,0.026,0.026,0.000676]],
        [{name  : "MemCache/set",
          scope : "WebTransaction/Uri/test"}, [1,0.026,0.002,0.026,0.026,0.000676]]
      ];

      expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result));
    });
  });
});
