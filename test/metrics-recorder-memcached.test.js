'use strict';

var path           = require('path')
  , chai           = require('chai')
  , expect         = chai.expect
  , helper         = require(path.join(__dirname, 'lib', 'agent_helper.js'))
  , recordMemcache = require(path.join(__dirname, '..', 'lib', 'metrics',
                                        'recorders', 'memcached.js'))
  , Transaction    = require(path.join(__dirname, '..', 'lib', 'transaction.js'))
  ;

function makeSegment(options) {
  var segment = options.transaction.getTrace().root
                  .add('Datastore/operation/Memcache/set');
  segment.setDurationInMillis(options.duration);
  segment._setExclusiveDurationInMillis(options.exclusive);
  segment.host = 'localhost';
  segment.port = 11211;

  return segment;
}

function record(options) {
  if (options.apdexT) options.transaction.metrics.apdexT = options.apdexT;

  var segment     = makeSegment(options)
    , transaction = options.transaction
    ;

  transaction.setName(options.url, options.code);
  recordMemcache(segment, options.transaction.name);
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
      expect(function () { recordMemcache(segment, undefined); }).not.throws();
    });

    it("should record no scoped metrics", function () {
      recordMemcache(segment, undefined);

      var result = [
        [{name : "Datastore/operation/Memcache/set"},            [1,0,0,0,0,0]],
        [{name : "Datastore/allOther"},                          [1,0,0,0,0,0]],
        [{name : "Datastore/all"},                               [1,0,0,0,0,0]],
        [{name : "Datastore/instance/Memcache/localhost:11211"}, [1,0,0,0,0,0]]
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
        [{name  : "Datastore/operation/Memcache/set"},
         [1,0.026,0.002,0.026,0.026,0.000676]],
        [{name  : "Datastore/allWeb"},
         [1,0.026,0.002,0.026,0.026,0.000676]],
        [{name  : "Datastore/all"},
         [1,0.026,0.002,0.026,0.026,0.000676]],
        [{name  : "Datastore/instance/Memcache/localhost:11211"},
         [1,0.026,0.002,0.026,0.026,0.000676]],
        [{name  : "Datastore/operation/Memcache/set",
          scope : "WebTransaction/NormalizedUri/*"},
         [1,0.026,0.002,0.026,0.026,0.000676]]
      ];

      expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result));
    });
  });

  it("should report exclusive time correctly", function () {
    var root   = trans.getTrace().root
      , parent = root.add('Datastore/operation/Memcache/get',     recordMemcache)
      , child1 = parent.add('Datastore/operation/Memcache/set',   recordMemcache)
      , child2 = parent.add('Datastore/operation/Memcache/clear', recordMemcache)
      ;

    root.setDurationInMillis(26, 0);
    parent.setDurationInMillis(26, 0);
    child1.setDurationInMillis(12, 3);
    child2.setDurationInMillis(8, 25);

    trans.end();

    var result = [
      [{name : "Datastore/operation/Memcache/get"},
       [1,0.026,0.013,0.026,0.026,0.000676]],
      [{name : "Datastore/allOther"},
       [3,0.046,0.033,0.008,0.026,0.000884]],
      [{name : "Datastore/all"},
       [3,0.046,0.033,0.008,0.026,0.000884]],
      [{name : "Datastore/operation/Memcache/set"},
       [1,0.012,0.012,0.012,0.012,0.000144]],
      [{name : "Datastore/operation/Memcache/clear"},
       [1,0.008,0.008,0.008,0.008,0.000064]]
    ];

    expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result));
  });
});
