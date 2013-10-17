'use strict';

var path        = require('path')
  , chai        = require('chai')
  , expect      = chai.expect
  , helper      = require(path.join(__dirname, 'lib', 'agent_helper'))
  , recordWeb   = require(path.join(__dirname, '..', 'lib', 'metrics',
                                    'recorders', 'http'))
  , Transaction = require(path.join(__dirname, '..', 'lib', 'transaction'))
  ;

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
  segment.markAsWeb(options.url);
  recordWeb(segment, options.transaction.name);
}

describe("recordWeb", function () {
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
      expect(function () { recordWeb(segment, undefined); }).not.throws();
    });

    it("should record no metrics", function () {
      recordWeb(segment, undefined);
      expect(JSON.stringify(trans.metrics)).equal(JSON.stringify([]));
    });
  });

  describe("when recording web transactions", function () {
    describe("with normal requests", function () {
      it("should infer a satisfying end-user experience", function () {
        record({
          transaction : trans,
          apdexT      : 0.06,
          url         : '/test',
          code        : 200,
          duration    : 55,
          exclusive   : 55
        });

        var result = [
          [{name  : 'WebTransaction'},                 [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name  : 'HttpDispatcher'},                 [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name  : 'WebTransaction/NormalizedUri/*'}, [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name  : 'Apdex/NormalizedUri/*'},          [1,     0,     0,  0.06,  0.06,        0]],
          [{name  : 'Apdex'},                          [1,     0,     0,  0.06,  0.06,        0]],
          [{name  : 'WebTransaction/NormalizedUri/*',
            scope : 'WebTransaction/NormalizedUri/*'}, [1, 0.055, 0.055, 0.055, 0.055, 0.003025]]
        ];
        expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result));
      });

      it("should infer a tolerable end-user experience", function () {
        record({
          transaction : trans,
          apdexT      : 0.05,
          url         : '/test',
          code        : 200,
          duration    : 55,
          exclusive   : 100
        });

        var result = [
          [{name  : 'WebTransaction'},                 [1, 0.055, 0.1, 0.055, 0.055, 0.003025]],
          [{name  : 'HttpDispatcher'},                 [1, 0.055, 0.1, 0.055, 0.055, 0.003025]],
          [{name  : 'WebTransaction/NormalizedUri/*'}, [1, 0.055, 0.1, 0.055, 0.055, 0.003025]],
          [{name  : 'Apdex/NormalizedUri/*'},          [0,     1,   0,  0.05,  0.05,        0]],
          [{name  : 'Apdex'},                          [0,     1,   0,  0.05,  0.05,        0]],
          [{name  : 'WebTransaction/NormalizedUri/*',
            scope : 'WebTransaction/NormalizedUri/*'}, [1, 0.055, 0.1, 0.055, 0.055, 0.003025]]
        ];
        expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result));
      });

      it("should infer a frustrating end-user experience", function () {
        record({
          transaction : trans,
          apdexT      : 0.01,
          url         : '/test',
          code        : 200,
          duration    : 55,
          exclusive   : 55
        });

        var result = [
          [{name  : 'WebTransaction'},                 [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name  : 'HttpDispatcher'},                 [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name  : 'WebTransaction/NormalizedUri/*'}, [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name  : 'Apdex/NormalizedUri/*'},          [0,     0,     1,  0.01,  0.01,        0]],
          [{name  : 'Apdex'},                          [0,     0,     1,  0.01,  0.01,        0]],
          [{name  : 'WebTransaction/NormalizedUri/*',
            scope : 'WebTransaction/NormalizedUri/*'}, [1, 0.055, 0.055, 0.055, 0.055, 0.003025]]
        ];
        expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result));
      });

      it("should chop query strings delimited by ? from request URLs", function () {
        record({
          transaction : trans,
          url         : '/test?test1=value1&test2&test3=50',
        });

        expect(trans.url).equal('/test');
      });

      it("should chop query strings delimited by ; from request URLs", function () {
        record({
          transaction : trans,
          url         : '/test;jsessionid=c83048283dd1328ac21aed8a8277d',
        });

        expect(trans.url).equal('/test');
      });
    });

    describe("with exceptional requests", function () {
      it("should handle missing resources", function () {
        record({
          transaction : trans,
          apdexT      : 0.01,
          url         : '/test',
          code        : 404,
          duration    : 55,
          exclusive   : 55
        });

        var result = [
          [{name  : 'WebTransaction'},                 [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name  : 'HttpDispatcher'},                 [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name  : 'WebTransaction/NormalizedUri/*'}, [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name  : 'Apdex/NormalizedUri/*'},          [0,     0,     1,  0.01,  0.01,        0]],
          [{name  : 'Apdex'},                          [0,     0,     1,  0.01,  0.01,        0]],
          [{name  : 'WebTransaction/NormalizedUri/*',
            scope : 'WebTransaction/NormalizedUri/*'}, [1, 0.055, 0.055, 0.055, 0.055, 0.003025]]
        ];
        expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result));
      });

      it("should handle bad requests", function () {
        record({
          transaction : trans,
          apdexT      : 0.01,
          url         : '/test',
          code        : 400,
          duration    : 55,
          exclusive   : 55
        });

        var result = [
          [{name  : 'WebTransaction'},           [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name  : 'HttpDispatcher'},           [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name  : 'WebTransaction/Uri/400/*'}, [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name  : 'Apdex/Uri/400/*'},          [0,     0,     1,  0.01,  0.01,        0]],
          [{name  : 'Apdex'},                    [0,     0,     1,  0.01,  0.01,        0]],
          [{name  : 'WebTransaction/Uri/400/*',
            scope : 'WebTransaction/Uri/400/*'}, [1, 0.055, 0.055, 0.055, 0.055, 0.003025]]
        ];
        expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result));
      });

      it("should handle over-long URIs", function () {
        record({
          transaction : trans,
          apdexT      : 0.01,
          url         : '/test',
          code        : 414,
          duration    : 55,
          exclusive   : 55
        });

        var result = [
          [{name  : 'WebTransaction'},           [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name  : 'HttpDispatcher'},           [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name  : 'WebTransaction/Uri/414/*'}, [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name  : 'Apdex/Uri/414/*'},          [0,     0,     1,  0.01,  0.01,        0]],
          [{name  : 'Apdex'},                    [0,     0,     1,  0.01,  0.01,        0]],
          [{name  : 'WebTransaction/Uri/414/*',
            scope : 'WebTransaction/Uri/414/*'}, [1, 0.055, 0.055, 0.055, 0.055, 0.003025]]
        ];
        expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result));
      });

      it("should handle internal server errors", function () {
        record({
          transaction : trans,
          apdexT      : 0.01,
          url         : '/test',
          code        : 500,
          duration    : 1,
          exclusive   : 1
        });

        var result = [
          [{name  : 'WebTransaction'},           [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
          [{name  : 'HttpDispatcher'},           [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
          [{name  : 'WebTransaction/Uri/500/*'}, [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
          [{name  : 'Apdex/Uri/500/*'},          [0,     0,     1,  0.01,  0.01,        0]],
          [{name  : 'Apdex'},                    [0,     0,     1,  0.01,  0.01,        0]],
          [{name  : 'WebTransaction/Uri/500/*',
            scope : 'WebTransaction/Uri/500/*'}, [1, 0.001, 0.001, 0.001, 0.001, 0.000001]]
        ];
        expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result));
      });
    });
  });

  describe("when testing a web request's apdex", function () {
    it("shouldn't automatically mark ignored status codes as frustrating", function () {
      // FIXME: probably shouldn't do all this through side effects
      trans.statusCode = 404;
      trans._setApdex('Apdex/Uri/test', 30);
      var result = [
        [{name : 'Apdex/Uri/test'}, [1, 0, 0, 0.1, 0.1, 0]]
      ];
      expect(agent.config.error_collector.ignore_status_codes).deep.equal([404]);
      expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result));
    });

    it("should handle ignored codes for the whole transaction", function () {
      record({
        transaction : trans,
        apdexT      : 0.2,
        url         : '/test',
        code        : 404,
        duration    : 1,
        exclusive   : 1
      });

      var result = [
        [{name  : 'WebTransaction'},                 [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
        [{name  : 'HttpDispatcher'},                 [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
        [{name  : 'WebTransaction/NormalizedUri/*'}, [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
        [{name  : 'Apdex/NormalizedUri/*'},          [1,     0,     0,   0.2,   0.2,        0]],
        [{name  : 'Apdex'},                          [1,     0,     0,   0.2,   0.2,        0]],
        [{name  : 'WebTransaction/NormalizedUri/*',
          scope : 'WebTransaction/NormalizedUri/*'}, [1, 0.001, 0.001, 0.001, 0.001, 0.000001]]
      ];
      expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result));
    });

    it("should otherwise mark error status codes as frustrating", function () {
      // FIXME: probably shouldn't do all this through side effects
      trans.statusCode = 503;
      trans._setApdex('Apdex/Uri/test', 30);
      var result = [
        [{name : 'Apdex/Uri/test'}, [0, 0, 1, 0.1, 0.1, 0]]
      ];
      expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result));
    });

    it("should handle non-ignored codes for the whole transaction", function () {
      record({
        transaction : trans,
        apdexT      : 0.2,
        url         : '/test',
        code        : 503,
        duration    : 1,
        exclusive   : 1
      });

      var result = [
        [{name  : 'WebTransaction'},           [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
        [{name  : 'HttpDispatcher'},           [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
        [{name  : 'WebTransaction/Uri/503/*'}, [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
        [{name  : 'Apdex/Uri/503/*'},          [0,     0,     1,   0.2,   0.2,        0]],
        [{name  : 'Apdex'},                    [0,     0,     1,   0.2,   0.2,        0]],
        [{name  : 'WebTransaction/Uri/503/*',
          scope : 'WebTransaction/Uri/503/*'}, [1, 0.001, 0.001, 0.001, 0.001, 0.000001]]
      ];
      expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result));
    });
  });
});
