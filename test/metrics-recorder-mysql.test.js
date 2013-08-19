'use strict';

var path            = require('path')
  , chai            = require('chai')
  , expect          = chai.expect
  , helper          = require(path.join(__dirname, 'lib', 'agent_helper'))
  , web             = require(path.join(__dirname, '..', 'lib', 'transaction', 'web'))
  , ParsedStatement = require(path.join(__dirname, '..', 'lib', 'db', 'parsed-statement'))
  , Transaction     = require(path.join(__dirname, '..', 'lib', 'transaction'))
  ;

function makeSegment(options) {
  var segment = options.transaction.getTrace().root.add('MySQL/select/users');
  segment.setDurationInMillis(options.duration);
  segment._setExclusiveDurationInMillis(options.exclusive);

  return segment;
}

function makeRecorder(operation, model) {
  var statement = new ParsedStatement(operation, model);
  return statement.recordMetrics.bind(statement);
}

function recordMySQL(segment, scope) {
  makeRecorder('select', 'users')(segment, scope);
}

function record(options) {
  if (options.apdexT) options.transaction.metrics.apdexT = options.apdexT;

  var segment = makeSegment(options)
    , root    = options.transaction.getTrace().root
    ;

  web.normalizeAndName(root, options.url, options.code);
  recordMySQL(segment, options.transaction.scope);
}

describe("record ParsedStatement with MySQL", function () {
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
      expect(function () { recordMySQL(segment, undefined); }).not.throws();
    });

    it("should record no scoped metrics", function () {
      recordMySQL(segment, undefined);

      var result = [
        [{name : "MySQL/select/users"},    [1,0,0,0,0,0]],
        [{name : "Database/users/select"}, [1,0,0,0,0,0]],
        [{name : "Database/select"},       [1,0,0,0,0,0]],
        [{name : "Database/all/Other"},    [1,0,0,0,0,0]],
        [{name : "Database/all"},          [1,0,0,0,0,0]]
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
        [{name  : "MySQL/select/users"},      [1,0.026,0.002,0.026,0.026,0.000676]],
        [{name  : "Database/users/select"},   [1,0.026,0.002,0.026,0.026,0.000676]],
        [{name  : "Database/select"},         [1,0.026,0.002,0.026,0.026,0.000676]],
        [{name  : "Database/all/Web"},        [1,0.026,0.002,0.026,0.026,0.000676]],
        [{name  : "Database/all"},            [1,0.026,0.002,0.026,0.026,0.000676]],
        [{name  : "MySQL/select/users",
          scope : "WebTransaction/Uri/test"}, [1,0.026,0.002,0.026,0.026,0.000676]],
        [{name  : "Database/users/select",
          scope : "WebTransaction/Uri/test"}, [1,0.026,0.002,0.026,0.026,0.000676]]
      ];

      expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result));
    });
  });

  it("should report exclusive time correctly", function () {
    var root   = trans.getTrace().root
      , parent = root.add('MySQL/select/users',   makeRecorder('select', 'users'))
      , child1 = parent.add('MySQL/insert/users', makeRecorder('insert', 'users'))
      , child2 = child1.add('MySQL/update/cache', makeRecorder('update', 'cache'))
      ;

    root.setDurationInMillis(26, 0);
    parent.setDurationInMillis(26, 0);
    child1.setDurationInMillis(12, 3);
    child2.setDurationInMillis(8, 10);

    trans.end();

    var result = [
      [{name : "MySQL/select/users"},    [1,0.026,0.014,0.026,0.026,0.000676]],
      [{name : "Database/users/select"}, [1,0.026,0.014,0.026,0.026,0.000676]],
      [{name : "Database/select"},       [1,0.026,0.014,0.026,0.026,0.000676]],
      [{name : "Database/all/Other"},    [3,0.046,0.029,0.008,0.026,0.000884]],
      [{name : "Database/all"},          [3,0.046,0.029,0.008,0.026,0.000884]],
      [{name : "MySQL/insert/users"},    [1,0.012,0.007,0.012,0.012,0.000144]],
      [{name : "Database/users/insert"}, [1,0.012,0.007,0.012,0.012,0.000144]],
      [{name : "Database/insert"},       [1,0.012,0.007,0.012,0.012,0.000144]],
      [{name : "MySQL/update/cache"},    [1,0.008,0.008,0.008,0.008,0.000064]],
      [{name : "Database/cache/update"}, [1,0.008,0.008,0.008,0.008,0.000064]],
      [{name : "Database/update"},       [1,0.008,0.008,0.008,0.008,0.000064]]
    ];

    expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result));
  });
});
