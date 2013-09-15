'use strict';

var path             = require('path')
  , chai             = require('chai')
  , expect           = chai.expect
  , helper           = require(path.join(__dirname, 'lib', 'agent_helper'))
  , generateRecorder = require(path.join(__dirname, '..', 'lib', 'metrics',
                                    'recorders', 'http_external'))
  , Transaction      = require(path.join(__dirname, '..', 'lib', 'transaction'))
  ;

function recordExternal(segment, scope) {
  return generateRecorder('test.example.com', 'http')(segment, scope);
}

function makeSegment(options) {
  var segment = options.transaction.getTrace().root.add('placeholder');
  segment.setDurationInMillis(options.duration);
  segment._setExclusiveDurationInMillis(options.exclusive);

  return segment;
}

function record(options) {
  if (options.apdexT) options.transaction.metrics.apdexT = options.apdexT;

  var segment     = makeSegment(options)
    , transaction = options.transaction
    ;

  transaction.setName(options.url, options.code);
  recordExternal(segment, options.transaction.name);
}

describe("recordExternal", function () {
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
      expect(function () { recordExternal(segment, undefined); }).not.throws();
    });

    it("should record no scoped metrics", function () {
      recordExternal(segment, undefined);

      var result = [
        [{name : "External/test.example.com/http"}, [1,0,0,0,0,0]],
        [{name : "External/allOther"},              [1,0,0,0,0,0]],
        [{name : "External/test.example.com/all"},  [1,0,0,0,0,0]],
        [{name : "External/all"},                   [1,0,0,0,0,0]]
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
        [{name  : "External/test.example.com/http"}, [1,0.026,0.002,0.026,0.026,0.000676]],
        [{name  : "External/allWeb"},                [1,0.026,0.002,0.026,0.026,0.000676]],
        [{name  : "External/test.example.com/all"},  [1,0.026,0.002,0.026,0.026,0.000676]],
        [{name  : "External/all"},                   [1,0.026,0.002,0.026,0.026,0.000676]],
        [{name  : "External/test.example.com/http",
          scope : "WebTransaction/NormalizedUri/*"}, [1,0.026,0.002,0.026,0.026,0.000676]]
      ];

      expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result));
    });
  });

  it("should report exclusive time correctly", function () {
    var root   = trans.getTrace().root
      , parent = root.add('/parent',   recordExternal)
      , child1 = parent.add('/child1', generateRecorder('api.twitter.com', 'https'))
      , child2 = parent.add('/child2', generateRecorder('oauth.facebook.com', 'http'))
      ;

    root.setDurationInMillis(26, 0);
    parent.setDurationInMillis(26, 0);
    child1.setDurationInMillis(12, 3);
    child2.setDurationInMillis(8, 4);

    trans.end();

    var result = [
      [{name : "External/test.example.com/http"},   [1,0.026,0.014,0.026,0.026,0.000676]],
      [{name : "External/allOther"},                [3,0.046,0.034,0.008,0.026,0.000884]],
      [{name : "External/test.example.com/all"},    [1,0.026,0.014,0.026,0.026,0.000676]],
      [{name : "External/all"},                     [3,0.046,0.034,0.008,0.026,0.000884]],
      [{name : "External/api.twitter.com/https"},   [1,0.012,0.012,0.012,0.012,0.000144]],
      [{name : "External/api.twitter.com/all"},     [1,0.012,0.012,0.012,0.012,0.000144]],
      [{name : "External/oauth.facebook.com/http"}, [1,0.008,0.008,0.008,0.008,0.000064]],
      [{name : "External/oauth.facebook.com/all"},  [1,0.008,0.008,0.008,0.008,0.000064]]
    ];

    expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result));
  });
});
