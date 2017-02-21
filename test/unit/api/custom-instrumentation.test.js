'use strict'

var expect = require('chai').expect
var helper = require('../../lib/agent_helper.js')
var API = require('../../../api.js')
var assertMetrics = require('../../lib/metrics_helper').assertMetrics


describe('The custom instrumentation API', function () {
  var agent
  var api

  beforeEach(function () {
    // FLAG: custom_instrumentation
    agent = helper.loadMockedAgent({custom_instrumentation: true})
    api = new API(agent)
  })

  afterEach(function () {
    helper.unloadAgent(agent)
  })

  describe('when creating a segment', function () {
    it('should work in a clean transaction', function (done) {
      agent.on('transactionFinished', function (transaction) {
        var trace = transaction.trace
        expect(trace).to.exist()
        expect(trace.root.children).to.have.length(1)
        var segment = trace.root.children[0]
        expect(segment.name).to.equal('custom:segment')
        done()
      })

      helper.runInTransaction(agent, function (transaction) {
        var markedFunction = api.createTracer('custom:segment', function () {
          process.nextTick(transaction.end.bind(transaction))
        })
        markedFunction()
      })
    })

    it('should work nested in a segment', function (done) {
      agent.on('transactionFinished', function (transaction) {
        var trace = transaction.trace
        expect(trace).to.exist()
        var trace = transaction.trace
        expect(trace).to.exist()
        expect(trace.root.children).to.have.length(1)
        var parentSegment = trace.root.children[0]
        expect(parentSegment.name).to.equal('parent')
        expect(parentSegment.children).to.have.length(1)
        var customSegment = parentSegment.children[0]
        expect(customSegment.name).to.equal('custom:segment')
        done()
      })

      helper.runInTransaction(agent, function (transaction) {
        agent.tracer.addSegment('parent', null, null, false, function(parentSegment) {
          var markedFunction = api.createTracer('custom:segment', function () {
            process.nextTick(function() {
              parentSegment.end()
              transaction.end()
            })
          })
          markedFunction()
        })
      })
    })

    it('should work with a segment nested in it', function (done) {
      agent.on('transactionFinished', function (transaction) {
        var trace = transaction.trace
        expect(trace).to.exist()
        var trace = transaction.trace
        expect(trace).to.exist()
        expect(trace.root.children).to.have.length(1)
        var customSegment = trace.root.children[0]
        expect(customSegment.name).to.equal('custom:segment')
        expect(customSegment.children).to.have.length(1)
        var childSegment = customSegment.children[0]
        expect(childSegment.name).to.equal('child')
        done()
      })

      helper.runInTransaction(agent, function (transaction) {
        var markedFunction = api.createTracer('custom:segment', function () {
          var childSegment = agent.tracer.createSegment('child')
          process.nextTick(function() {
            childSegment.end()
            transaction.end()
          })
        })
        markedFunction()
      })
    })

    it('should not cause any errors if called outside of a transaction', function () {
      expect(function () {
        api.createTracer('custom:segment', function nop() {})
      }).to.not.throw
    })

    it('should return the function unwrapped if it is called outside of a transaction', function () {
      function nop() {}
      var retVal = api.createTracer('custom:segment', nop)
      expect(retVal.name).to.equal('nop')
    })

    // FLAG: custom_instrumentation
    it('should not cause problems when feature flag is disabled', function (done) {
      agent.config.feature_flag.custom_instrumentation = false

      agent.on('transactionFinished', function (transaction) {
        var trace = transaction.trace
        expect(trace).to.exist()
        var trace = transaction.trace
        expect(trace).to.exist()
        expect(trace.root.children).to.have.length(0)
        done()
      })

      helper.runInTransaction(agent, function (transaction) {
        var markedFunction = api.createTracer('custom:segment', function () {
          transaction.end()
        })
        markedFunction()
      })
    })

    it('should record a metric for the custom segment', function (done) {
      agent.on('transactionFinished', function (transaction) {
        expect(transaction.metrics.unscoped).to.have.property('Custom/custom:segment')
        done()
      })

      helper.runInTransaction(agent, function (transaction) {
        var markedFunction = api.createTracer('custom:segment', function () {
          process.nextTick(transaction.end.bind(transaction))
        })
        markedFunction()
      })
    })

    it('should allow the user to return a value from the handle', function () {
      helper.runInTransaction(agent, function (transaction) {
        var markedFunction = api.createTracer('custom:segment', function () {
          return 'something'
          transaction.end()
        })
        var value = markedFunction()
        expect(value).to.be.equal('something')
      })
    })

    it('should include end time if transaction ends in callback', function (done) {
      agent.on('transactionFinished', function (transaction) {
        var segment = transaction.trace.root.children[0]
        expect(segment.getDurationInMillis()).greaterThan(0)
        done()
      })

      helper.runInTransaction(agent, function (transaction) {
        var markedFunction = api.createTracer('custom:segment', function () {
          transaction.end()
        })
        setTimeout(markedFunction, 0)
      })
    })

  })

  describe('when creating a web transaction', function () {
    it('should return a function', function () {
      var txHandler = api.createWebTransaction('/custom/transaction', function () {
      })
      expect(txHandler).to.be.a('function')
    })

    it('should create a transaction', function (done) {
      var txHandler = api.createWebTransaction('/custom/transaction', function () {
        var tx = agent.tracer.getTransaction()
        expect(tx).to.exist()
        expect(tx.url).to.be.equal('/custom/transaction')
        // clean up tx so it doesn't cause other problems
        tx.end()
        done()
      })
      expect(agent.tracer.getTransaction()).to.not.exist()
      txHandler()
    })

    it('should create an outermost segment', function (done) {
      var txHandler = api.createWebTransaction('/custom/transaction', function () {
        var tx = agent.tracer.getTransaction()
        expect(tx).to.exist()

        var trace = tx.trace
        expect(trace.root.children).to.have.length(1)

        // clean up tx so it doesn't cause other problems
        tx.end()
        done()
      })

      txHandler()
    })

    it('should respect the in play transaction and not create a new one', function (done) {
      var txHandler = api.createWebTransaction('/custom/transaction', function (outerTx) {
        var tx = agent.tracer.getTransaction()
        expect(tx).to.be.equal(outerTx)

        var trace = tx.trace
        expect(trace.root.children).to.have.length(1)

        done()
      })
      helper.runInTransaction(agent, function (transaction) {

        txHandler(transaction)
        transaction.end()
      })
    })

    it('should nest its segment within an in play segment', function (done) {
      var txHandler = api.createWebTransaction('/custom/transaction', function (outerTx) {
        var tx = agent.tracer.getTransaction()
        expect(tx).to.be.equal(outerTx)

        var trace = tx.trace
        expect(trace.root.children).to.have.length(1)
        var child = trace.root.children[0]
        expect(child.name).to.equal('outer')
        expect(child.children).to.have.length(1)

        done()
      })

      helper.runInTransaction(agent, function (transaction) {
        agent.tracer.addSegment('outer', null, null, false, function() {
          txHandler(transaction)
          transaction.end()
        })
      })
    })

    it('should be ended by calling endTransaction', function (done) {
      var txHandler = api.createWebTransaction('/custom/transaction', function () {
        var tx = agent.tracer.getTransaction()

        expect(tx.isActive()).to.be.true
        api.endTransaction()
        expect(tx.isActive()).to.be.false

        done()
      })
      txHandler()
    })

    it('should set name of webSegment correctly', function (done) {
      var txHandler = api.createWebTransaction('/custom/transaction', function () {
        var tx = agent.tracer.getTransaction()

        expect(tx.webSegment.name).to.equal('/custom/transaction')
        api.endTransaction()
        expect(tx.webSegment.name).to.equal('WebTransaction/Custom//custom/transaction')
        done()
      })
      txHandler()
    })

    it('should create only one rollup metric when nested', function(done) {
      var handler1 = api.createWebTransaction('/custom1', function() {
        handler2()
        api.endTransaction()
      })

      var handler2 = api.createWebTransaction('/custom2', function(outerTx) {
        api.endTransaction()
      })

      handler1()

      agent.on('transactionFinished', function(tx) {
        expect(tx.metrics.getMetric('WebTransaction').callCount).equal(1)
        expect(tx.metrics.getMetric('WebTransactionTotalTime').callCount).equal(1)
        done()
      })
    })

    it('should create proper metrics', function (done) {
      var txHandler = api.createWebTransaction('/custom/transaction', function () {
        var tx = agent.tracer.getTransaction()
        expect(tx).to.exist()
        api.endTransaction()
      })
      expect(agent.tracer.getTransaction()).to.not.exist()
      txHandler()

      var expectedMetrics = [
        [{"name": "WebTransaction"}],
        [{"name": "WebTransactionTotalTime"}],
        [{"name": "HttpDispatcher"}],
        [{"name": "WebTransaction/Custom//custom/transaction"}],
        [{"name": "Apdex/Custom//custom/transaction"}],
        [{"name": "Apdex"}],
        [{"name": "WebTransaction/Custom//custom/transaction"}]
      ]
      agent.on('transactionFinished', function(tx) {
        assertMetrics(tx.metrics, expectedMetrics, true, false)
        done()
      })
    })

    it('should create a new transaction when nested within a background transaction', function (done) {
      var bgHandler = api.createBackgroundTransaction('background:job', function () {
        var tx = agent.tracer.getTransaction()
        expect(tx).to.exist()
        expect(tx.name).to.be.equal('OtherTransaction/Nodejs/background:job')
        expect(tx.webSegment).to.not.exist()
        expect(tx.bgSegment).to.exist()
        var webHandler = api.createWebTransaction('/custom/transaction', function () {
          var tx = agent.tracer.getTransaction()
          expect(tx).to.exist()
          expect(tx.url).to.be.equal('/custom/transaction')
          expect(tx.webSegment).to.exist()
          expect(tx.bgSegment).to.not.exist()
          // clean up tx so it doesn't cause other problems
          tx.end()
          done()
        })
        webHandler()
        // clean up tx so it doesn't cause other problems
        tx.end()
      })
      expect(agent.tracer.getTransaction()).to.not.exist()
      bgHandler()
    })

    it('should return the any value that the handler returns', function () {
      var txHandler = api.createWebTransaction('/custom/transaction', function () {
        return 'a thing'
      })
      var value = txHandler()
      expect(value).to.be.equal('a thing')
    })

    it('should allow changing the transaction name', function (done) {
      var txHandler = api.createWebTransaction('/custom/transaction', function (outerTx) {
        var tx = agent.tracer.getTransaction()

        api.setTransactionName('new_name')
        api.endTransaction()

        expect(tx.name).to.be.equal('WebTransaction/Custom/new_name')
        done()
      })

      txHandler()
    })
  })

  describe('when creating an background transaction', function () {
    it('should return a function', function () {
      var txHandler = api.createBackgroundTransaction('background:job', function () {})
      expect(txHandler).to.be.a('function')
    })

    it('should create a transaction', function (done) {
      var txHandler = api.createBackgroundTransaction('background:job', function () {
        var tx = agent.tracer.getTransaction()
        expect(tx).to.exist()
        expect(tx.name).to.be.equal('OtherTransaction/Nodejs/background:job')

        // clean up tx so it doesn't cause other problems
        tx.end()
        done()
      })
      expect(agent.tracer.getTransaction()).to.not.exist()
      txHandler()
    })

    it('should create an outermost segment', function (done) {
        var txHandler = api.createBackgroundTransaction('background:job', function () {
        var tx = agent.tracer.getTransaction()
        expect(tx).to.exist()

        var trace = tx.trace
        expect(trace.root.children).to.have.length(1)

        // clean up tx so it doesn't cause other problems
        tx.end()
        done()
      })

      txHandler()
    })

    it('should respect the in play transaction and not create a new one', function (done) {
      var txHandler = api.createBackgroundTransaction('background:job', function (outerTx) {
        var tx = agent.tracer.getTransaction()
        expect(tx).to.be.equal(outerTx)

        var trace = tx.trace
        expect(trace.root.children).to.have.length(1)

        done()
      })

      helper.runInTransaction(agent, function (transaction) {
        txHandler(transaction)
        transaction.end()
      })
    })

    it('should nest its segment within an in play segment', function (done) {
        var txHandler = api.createBackgroundTransaction('background:job', function (outerTx) {
        var tx = agent.tracer.getTransaction()
        expect(tx).to.be.equal(outerTx)

        var trace = tx.trace
        expect(trace.root.children).to.have.length(1)
        var child = trace.root.children[0]
        expect(child.name).to.equal('outer')
        expect(child.children).to.have.length(1)

        done()
      })

      helper.runInTransaction(agent, function (transaction) {
        agent.tracer.addSegment('outer', null, null, false, function() {
          txHandler(transaction)
          transaction.end()
        })
      })
    })

    it('should be ended by calling endTransaction', function (done) {
      var txHandler = api.createWebTransaction('background:job', function () {
        var tx = agent.tracer.getTransaction()

        expect(tx.isActive()).to.be.true
        api.endTransaction()
        expect(tx.isActive()).to.be.false

        done()
      })
      txHandler()
    })

    it('should create only one rollup metric when nested', function(done) {
      var handler1 = api.createBackgroundTransaction('custom1', function() {
        handler2()
        api.endTransaction()
      })

      var handler2 = api.createBackgroundTransaction('custom2', function(outerTx) {
        api.endTransaction()
      })

      handler1()

      agent.on('transactionFinished', function(tx) {
        expect(tx.metrics.getMetric('OtherTransaction/all').callCount).equal(1)
        expect(tx.metrics.getMetric('OtherTransactionTotalTime').callCount).equal(1)
        done()
      })
    })

    it('should create proper metrics with default group name', function (done) {
      var txHandler = api.createBackgroundTransaction('background:job', function () {
        var tx = agent.tracer.getTransaction()
        expect(tx).to.exist()
        api.endTransaction()
      })
      expect(agent.tracer.getTransaction()).to.not.exist()
      txHandler()

      var expectedMetrics = [
        [{"name": "OtherTransaction/Nodejs/background:job"}],
        [{"name": "OtherTransactionTotalTime/Nodejs/background:job"}],
        [{"name": "OtherTransaction/all"}],
        [{"name": "OtherTransactionTotalTime"}]
      ]
      agent.on('transactionFinished', function(tx) {
        assertMetrics(tx.metrics, expectedMetrics, true, false)
        done()
      })
    })

    it('should create proper metrics with group name', function (done) {
      var txHandler = api.createBackgroundTransaction('background:job', 'thinger', function () {
        var tx = agent.tracer.getTransaction()
        expect(tx).to.exist()
        api.endTransaction()
      })
      expect(agent.tracer.getTransaction()).to.not.exist()
      txHandler()

      var expectedMetrics = [
        [{"name": "OtherTransaction/thinger/background:job"}],
        [{"name": "OtherTransactionTotalTime/thinger/background:job"}],
        [{"name": "OtherTransaction/all"}],
        [{"name": "OtherTransactionTotalTime"}]
      ]
      agent.on('transactionFinished', function(tx) {
        assertMetrics(tx.metrics, expectedMetrics, true, false)
        done()
      })
    })

    it('should create a new transaction when nested within a web transaction', function (done) {
      var webHandler = api.createWebTransaction('/custom/transaction', function () {
        var tx = agent.tracer.getTransaction()
        expect(tx).to.exist()
        expect(tx.url).to.be.equal('/custom/transaction')
        expect(tx.webSegment).to.exist()
        expect(tx.bgSegment).to.not.exist()
        var bgHandler = api.createBackgroundTransaction('background:job', function () {
          var tx = agent.tracer.getTransaction()
          expect(tx).to.exist()
          expect(tx.name).to.be.equal('OtherTransaction/Nodejs/background:job')
          expect(tx.webSegment).to.not.exist()
          expect(tx.bgSegment).to.exist()
          // clean up tx so it doesn't cause other problems
          tx.end()
          done()
        })
        bgHandler()
        // clean up tx so it doesn't cause other problems
        tx.end()
      })
      expect(agent.tracer.getTransaction()).to.not.exist()
      webHandler()
    })

    it('should return the any value that the hanlder returns', function () {
      var txHandler = api.createBackgroundTransaction('/custom/transaction', function () {
        return 'a thing'
      })
      var value = txHandler()
      expect(value).to.be.equal('a thing')
    })
  })

  it('endTransaction should not throw an exception if there is no transaction active', function () {
    var tx = agent.tracer.getTransaction()
    expect(tx).to.not.exist()
    expect(function () {
      api.endTransaction()
    }).to.not.throw
  })
});
