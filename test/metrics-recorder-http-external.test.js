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
        duration : 30,
        exclusive : 2,
      });

      var result = [
        [{name  : "External/test.example.com/http"}, [1,0.030,0.002,0.030,0.030,0.0009]],
        [{name  : "External/allWeb"},                [1,0.030,0.002,0.030,0.030,0.0009]],
        [{name  : "External/test.example.com/all"},  [1,0.030,0.002,0.030,0.030,0.0009]],
        [{name  : "External/all"},                   [1,0.030,0.002,0.030,0.030,0.0009]],
        [{name  : "External/test.example.com/http",
          scope : "WebTransaction/NormalizedUri/*"}, [1,0.030,0.002,0.030,0.030,0.0009]]
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

    root.setDurationInMillis(  32,  0);
    parent.setDurationInMillis(32,  0);
    child1.setDurationInMillis(15, 10);
    child2.setDurationInMillis( 2,  1);

    trans.end();

    var result = [
      [{name : "External/test.example.com/http"},   [1,0.032,0.015,0.032,0.032,0.001024]],
      [{name : "External/allOther"},                [3,0.049,0.032,0.002,0.032,0.001253]],
      [{name : "External/test.example.com/all"},    [1,0.032,0.015,0.032,0.032,0.001024]],
      [{name : "External/all"},                     [3,0.049,0.032,0.002,0.032,0.001253]],
      [{name : "External/api.twitter.com/https"},   [1,0.015,0.015,0.015,0.015,0.000225]],
      [{name : "External/api.twitter.com/all"},     [1,0.015,0.015,0.015,0.015,0.000225]],
      [{name : "External/oauth.facebook.com/http"}, [1,0.002,0.002,0.002,0.002,0.000004]],
      [{name : "External/oauth.facebook.com/all"},  [1,0.002,0.002,0.002,0.002,0.000004]]
    ];

    expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result));
  });
});
