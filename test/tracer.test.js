'use strict';

var path    = require('path')
  , chai    = require('chai')
  , expect  = chai.expect
  , helper  = require(path.join(__dirname, 'lib', 'agent_helper'))
  , Context = require(path.join(__dirname, '..', 'lib', 'context'))
  , Tracer  = require(path.join(__dirname, '..', 'lib', 'transaction', 'tracer'))
  ;

describe('Tracer', function () {
  var agent
    , tracer
    ;

  beforeEach(function () {
    agent  = helper.loadMockedAgent();
    tracer = agent.tracer;
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
});
