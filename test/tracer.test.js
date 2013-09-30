'use strict';

var path    = require('path')
  , chai    = require('chai')
  , expect  = chai.expect
  , helper  = require(path.join(__dirname, 'lib', 'agent_helper'))
  ;

describe('Tracer', function () {
  var agent
    , tracer
    ;

  beforeEach(function () {
    agent  = helper.loadMockedAgent();
    tracer = agent.tracer;
  });

  afterEach(function () {
    helper.unloadAgent(agent);
  });

  describe("when proxying a trace segment", function () {
    it("should not try to wrap a null handler", function () {
      expect(tracer.transactionProxy(null)).equal(undefined);
    });
  });

  describe("when proxying a trace segment", function () {
    it("should not try to wrap a null handler", function () {
      helper.runInTransaction(agent, function () {
        expect(tracer.segmentProxy(null)).equal(undefined);
      });
    });
  });

  describe("when proxying a callback", function () {
    it("should not try to wrap a null handler", function () {
      helper.runInTransaction(agent, function () {
        expect(tracer.callbackProxy(null)).equal(undefined);
      });
    });
  });

  describe("when a transaction is created inside a transaction", function () {
    it("should reuse the existing transaction instead of nesting", function () {
      helper.runInTransaction(agent, function (trans) {
        var outer = trans.id;
        helper.runInTransaction(agent, function (trans) {
          var inner = trans.id;

          expect(inner).equal(outer);
        });
      });
    });
  });

  describe("when setting the current segment type", function () {
    it("it's set for the rest of the current tick", function () {
      tracer.setCurrentSegmentType('TEST1');

      expect(tracer.isCurrentSegmentType('TEST1')).equal(true);
    });

    it("it's not set in the future", function (done) {
      tracer.setCurrentSegmentType('TEST2');
      setTimeout(function () {
        expect(tracer.isCurrentSegmentType('TEST2')).equal(false);

        done();
      });
    });

    it("doesn't false positive when segment type has changed", function () {
      tracer.setCurrentSegmentType('TEST3');
      tracer.setCurrentSegmentType('nope');

      expect(tracer.isCurrentSegmentType('TEST3')).equal(false);
    });
  });
});
