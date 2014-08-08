'use strict';

var path   = require('path')
  , expect = require('chai').expect
  , helper = require(path.join(__dirname, 'lib', 'agent_helper.js'))
  , API    = require(path.join(__dirname, '..', 'api.js'))
  ;

describe('The custom instrumentation API', function () {
  var agent;
  var api;

  beforeEach(function () {
    // FLAG: custom_instrumentation
    agent = helper.loadMockedAgent({custom_instrumentation: true});
    api = new API(agent);
  });

  afterEach(function () {
    helper.unloadAgent(agent);
  });

  describe('when creating a segment', function () {
    it('should work in a clean transaction', function (done) {
      agent.on('transactionFinished', function (transaction) {
        var trace = transaction.getTrace();
        expect(trace).to.exist;
        expect(trace.root.children).to.have.length(1);
        var segment = trace.root.children[0];
        expect(segment.name).to.equal('custom:segment');
        done();
      });

      helper.runInTransaction(agent, function (transaction) {
        var markedFunction = api.createTracer('custom:segment', function () {
          transaction.end();
        });
        markedFunction();
      });
    });

    it('should work nested in a segment', function (done) {
      agent.on('transactionFinished', function (transaction) {
        var trace = transaction.getTrace();
        expect(trace).to.exist;
        expect(trace.root.children).to.have.length(1);
        var parentSegment = trace.root.children[0];
        expect(parentSegment.name).to.equal('parent');
        expect(parentSegment.children).to.have.length(1);
        var customSegment = parentSegment.children[0];
        expect(customSegment.name).to.equal('custom:segment');
        done();
      });

      helper.runInTransaction(agent, function (transaction) {
        agent.tracer.addSegment('parent');
        var markedFunction = api.createTracer('custom:segment', function () {
          transaction.end();
        });
        markedFunction();
      });
    });

    it('should work with a segment nested in it', function (done) {
      agent.on('transactionFinished', function (transaction) {
        var trace = transaction.getTrace();
        expect(trace).to.exist;
        expect(trace.root.children).to.have.length(1);
        var customSegment = trace.root.children[0];
        expect(customSegment.name).to.equal('custom:segment');
        expect(customSegment.children).to.have.length(1);
        var childSegment = customSegment.children[0];
        expect(childSegment.name).to.equal('child');
        done();
      });

      helper.runInTransaction(agent, function (transaction) {
        var markedFunction = api.createTracer('custom:segment', function () {
          agent.tracer.addSegment('child');
          transaction.end();
        });
        markedFunction();
      });
    });

    it('should not cause any errors if called outside of a transaction', function () {
      expect(function () {
        api.createTracer('custom:segment', function nop() {});
      }).to.not.throw;
    });

    it('should return the function unwrapped if it is called outside of a transaction', function () {
      function nop() {}
      var retVal = api.createTracer('custom:segment', nop);
      expect(retVal.name).to.equal('nop');
    });

    // FLAG: custom_instrumentation
    it('should not cause problems when feature flag is disabled', function (done) {
      agent.config.feature_flag.custom_instrumentation = false;

      agent.on('transactionFinished', function (transaction) {
        var trace = transaction.getTrace();
        expect(trace).to.exist;
        expect(trace.root.children).to.have.length(0);
        done();
      });

      helper.runInTransaction(agent, function (transaction) {
        var markedFunction = api.createTracer('custom:segment', function () {
          transaction.end();
        });
        markedFunction();
      });
    });
  });

  describe('when creating a web transaction', function () {
    it('should return a function', function () {
      var txHandler = api.createWebTransaction('/custom/transaction', function () {
      });
      expect(txHandler).to.be.a('function');
    });

    it('should create a transaction', function (done) {
      var txHandler = api.createWebTransaction('/custom/transaction', function () {
        var tx = agent.tracer.getTransaction();
        expect(tx).to.exist;
        expect(tx.url).to.be.equal('/custom/transaction');
        // clean up tx so it doesn't cause other problems
        tx.end();
        done();
      });

      txHandler();
    });

    it('should create an outermost segment', function (done) {
      var txHandler = api.createWebTransaction('/custom/transaction', function () {
        var tx = agent.tracer.getTransaction();
        expect(tx).to.exist;

        var trace = tx.getTrace();
        expect(trace.root.children).to.have.length(1);

        // clean up tx so it doesn't cause other problems
        tx.end();
        done();
      });

      txHandler();
    });

    it('should respect the in play transaction and not create a new one', function (done) {
      var txHandler = api.createWebTransaction('/custom/transaction', function (outerTx) {
        var tx = agent.tracer.getTransaction();
        expect(tx).to.be.equal(outerTx);

        var trace = tx.getTrace();
        expect(trace.root.children).to.have.length(1);

        done();
      });
      helper.runInTransaction(agent, function (transaction) {

        txHandler(transaction);
        transaction.end();
      });
    });

    it('should nest its segment within an in play segment', function (done) {
      var txHandler = api.createWebTransaction('/custom/transaction', function (outerTx) {
        var tx = agent.tracer.getTransaction();
        expect(tx).to.be.equal(outerTx);

        var trace = tx.getTrace();
        expect(trace.root.children).to.have.length(1);
        var child = trace.root.children[0];
        expect(child.name).to.equal('outer');
        expect(child.children).to.have.length(1);

        done();
      });

      helper.runInTransaction(agent, function (transaction) {
        agent.tracer.addSegment('outer');
        txHandler(transaction);
        transaction.end();
      });
    });

    it('should be ended by calling endTransaction', function (done) {
      var txHandler = api.createWebTransaction('/custom/transaction', function () {
        var tx = agent.tracer.getTransaction();

        expect(tx.isActive()).to.be.true;
        api.endTransaction();
        expect(tx.isActive()).to.be.false;

        done();
      });
      txHandler();
    });

    it('endTransaction should not throw an exception if there is no transaction active', function () {
      var tx = agent.tracer.getTransaction();
      expect(tx).to.not.exist;
      expect(function () {
        api.endTransaction();
      }).to.not.throw;
    });
  });
});