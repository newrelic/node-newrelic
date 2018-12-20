'use strict'

const API = require('../../../api')
const assertMetrics = require('../../lib/metrics_helper').assertMetrics
const expect = require('chai').expect
const helper = require('../../lib/agent_helper')


describe('The custom instrumentation API', () => {
  let agent = null
  let api = null

  beforeEach(() => {
    agent = helper.loadMockedAgent()
    api = new API(agent)
  })

  afterEach(() => {
    helper.unloadAgent(agent)
  })

  describe('when creating a segment', () => {
    it('should work in a clean transaction', (done) => {
      agent.on('transactionFinished', (transaction) => {
        var trace = transaction.trace
        expect(trace).to.exist
        expect(trace.root.children).to.have.length(1)
        var segment = trace.root.children[0]
        expect(segment.name).to.equal('custom:segment')
        done()
      })

      helper.runInTransaction(agent, (transaction) => {
        var markedFunction = api.createTracer('custom:segment', () => {
          process.nextTick(transaction.end.bind(transaction))
        })
        markedFunction()
      })
    })

    it('should work nested in a segment', (done) => {
      agent.on('transactionFinished', (transaction) => {
        var trace = transaction.trace
        expect(trace).to.exist
        var trace = transaction.trace
        expect(trace).to.exist
        expect(trace.root.children).to.have.length(1)
        var parentSegment = trace.root.children[0]
        expect(parentSegment.name).to.equal('parent')
        expect(parentSegment.children).to.have.length(1)
        var customSegment = parentSegment.children[0]
        expect(customSegment.name).to.equal('custom:segment')
        done()
      })

      helper.runInTransaction(agent, (transaction) => {
        agent.tracer.addSegment('parent', null, null, false, function(parentSegment) {
          var markedFunction = api.createTracer('custom:segment', () => {
            process.nextTick(() => {
              parentSegment.end()
              transaction.end()
            })
          })
          markedFunction()
        })
      })
    })

    it('should work with a segment nested in it', (done) => {
      agent.on('transactionFinished', (transaction) => {
        var trace = transaction.trace
        expect(trace).to.exist
        var trace = transaction.trace
        expect(trace).to.exist
        expect(trace.root.children).to.have.length(1)
        var customSegment = trace.root.children[0]
        expect(customSegment.name).to.equal('custom:segment')
        expect(customSegment.children).to.have.length(1)
        var childSegment = customSegment.children[0]
        expect(childSegment.name).to.equal('child')
        done()
      })

      helper.runInTransaction(agent, (transaction) => {
        var markedFunction = api.createTracer('custom:segment', () => {
          var childSegment = agent.tracer.createSegment('child')
          process.nextTick(() => {
            childSegment.end()
            transaction.end()
          })
        })
        markedFunction()
      })
    })

    it('should not cause any errors if called outside of a transaction', () => {
      expect(() => {
        api.createTracer('custom:segment', function nop() {})
      }).to.not.throw()
    })

    it('should return the function unwrapped if called outside a txn', () => {
      function nop() {}
      var retVal = api.createTracer('custom:segment', nop)
      expect(retVal.name).to.equal('nop')
    })

    it('should record a metric for the custom segment', (done) => {
      agent.on('transactionFinished', (transaction) => {
        expect(transaction.metrics.unscoped).to.have.property('Custom/custom:segment')
        done()
      })

      helper.runInTransaction(agent, (transaction) => {
        var markedFunction = api.createTracer('custom:segment', () => {
          process.nextTick(transaction.end.bind(transaction))
        })
        markedFunction()
      })
    })

    it('should allow the user to return a value from the handle', () => {
      helper.runInTransaction(agent, (transaction) => {
        var markedFunction = api.createTracer('custom:segment', () => {
          return 'something'
          transaction.end()
        })
        var value = markedFunction()
        expect(value).to.be.equal('something')
      })
    })

    it('should include end time if transaction ends in callback', (done) => {
      agent.on('transactionFinished', (transaction) => {
        var segment = transaction.trace.root.children[0]
        expect(segment.getDurationInMillis()).greaterThan(0)
        done()
      })

      helper.runInTransaction(agent, (transaction) => {
        var markedFunction = api.createTracer('custom:segment', () => {
          transaction.end()
        })
        setTimeout(markedFunction, 0)
      })
    })
  })

  describe('when creating a web transaction', () => {
    it('should return a function', () => {
      var txHandler = api.createWebTransaction('/custom/transaction', () => {
      })
      expect(txHandler).to.be.a('function')
    })

    it('should create a transaction', (done) => {
      var txHandler = api.createWebTransaction('/custom/transaction', () => {
        var tx = agent.tracer.getTransaction()
        expect(tx).to.exist
        expect(tx.url).to.be.equal('/custom/transaction')
        // clean up tx so it doesn't cause other problems
        tx.end()
        done()
      })
      expect(agent.tracer.getTransaction()).to.not.exist
      txHandler()
    })

    it('should create an outermost segment', (done) => {
      var txHandler = api.createWebTransaction('/custom/transaction', () => {
        var tx = agent.tracer.getTransaction()
        expect(tx).to.exist

        var trace = tx.trace
        expect(trace.root.children).to.have.length(1)

        // clean up tx so it doesn't cause other problems
        tx.end()
        done()
      })

      txHandler()
    })

    it('should respect the in play transaction and not create a new one', (done) => {
      var txHandler = api.createWebTransaction('/custom/transaction', (outerTx) => {
        var tx = agent.tracer.getTransaction()
        expect(tx).to.be.equal(outerTx)

        var trace = tx.trace
        expect(trace.root.children).to.have.length(1)

        done()
      })
      helper.runInTransaction(agent, (transaction) => {
        txHandler(transaction)
        transaction.end()
      })
    })

    it('should nest its segment within an in play segment', (done) => {
      var txHandler = api.createWebTransaction('/custom/transaction', (outerTx) => {
        var tx = agent.tracer.getTransaction()
        expect(tx).to.be.equal(outerTx)

        var trace = tx.trace
        expect(trace.root.children).to.have.length(1)
        var child = trace.root.children[0]
        expect(child.name).to.equal('outer')
        expect(child.children).to.have.length(1)

        done()
      })

      helper.runInTransaction(agent, (transaction) => {
        agent.tracer.addSegment('outer', null, null, false, () => {
          txHandler(transaction)
          transaction.end()
        })
      })
    })

    it('should be ended by calling endTransaction', (done) => {
      var txHandler = api.createWebTransaction('/custom/transaction', () => {
        var tx = agent.tracer.getTransaction()

        expect(tx.isActive()).to.be.true
        api.endTransaction()
        expect(tx.isActive()).to.be.false

        done()
      })
      txHandler()
    })

    it('should set name of baseSegment correctly', (done) => {
      var txHandler = api.createWebTransaction('/custom/transaction', () => {
        var tx = agent.tracer.getTransaction()

        expect(tx.type).to.equal('web')
        expect(tx.baseSegment.name).to.equal('/custom/transaction')
        api.endTransaction()
        expect(tx.baseSegment.name).to.equal('WebTransaction/Custom//custom/transaction')
        done()
      })
      txHandler()
    })

    it('should create only one rollup metric when nested', (done) => {
      var handler1 = api.createWebTransaction('/custom1', () => {
        handler2()
        api.endTransaction()
      })

      var handler2 = api.createWebTransaction('/custom2', () => api.endTransaction())

      handler1()

      agent.on('transactionFinished', function(tx) {
        expect(tx.metrics.getMetric('WebTransaction').callCount).equal(1)
        expect(tx.metrics.getMetric('WebTransactionTotalTime').callCount).equal(1)
        done()
      })
    })

    it('should create proper metrics', (done) => {
      var txHandler = api.createWebTransaction('/custom/transaction', () => {
        var tx = agent.tracer.getTransaction()
        expect(tx).to.exist
        api.endTransaction()
      })
      expect(agent.tracer.getTransaction()).to.not.exist
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

    it('should create a new txn when nested within a background txn', (done) => {
      var bgHandler = api.createBackgroundTransaction('background:job', () => {
        var tx = agent.tracer.getTransaction()
        expect(tx).to.exist
        expect(tx.getFullName()).to.equal('OtherTransaction/Nodejs/background:job')
        expect(tx.type).to.equal('bg')
        expect(tx.baseSegment).to.exist
        var webHandler = api.createWebTransaction('/custom/transaction', () => {
          var webTx = agent.tracer.getTransaction()
          expect(webTx).to.exist.and.not.equal(tx)
          expect(webTx.url).to.be.equal('/custom/transaction')
          expect(webTx.type).to.equal('web')
          expect(webTx.baseSegment).to.exist
          // clean up webTx so it doesn't cause other problems
          webTx.end()
          done()
        })
        webHandler()
        // clean up tx so it doesn't cause other problems
        tx.end()
      })
      expect(agent.tracer.getTransaction()).to.not.exist
      bgHandler()
    })

    it('should return the any value that the handler returns', () => {
      var txHandler = api.createWebTransaction('/custom/transaction', () => {
        return 'a thing'
      })
      var value = txHandler()
      expect(value).to.be.equal('a thing')
    })

    it('should allow changing the transaction name', (done) => {
      var txHandler = api.createWebTransaction('/custom/transaction', () => {
        var tx = agent.tracer.getTransaction()

        api.setTransactionName('new_name')
        api.endTransaction()

        expect(tx.name).to.be.equal('WebTransaction/Custom/new_name')
        done()
      })

      txHandler()
    })
  })

  describe('when creating an background transaction', () => {
    it('should return a function', () => {
      var txHandler = api.createBackgroundTransaction('background:job', () => {})
      expect(txHandler).to.be.a('function')
    })

    it('should create a transaction', (done) => {
      var txHandler = api.createBackgroundTransaction('background:job', () => {
        var tx = agent.tracer.getTransaction()
        expect(tx).to.exist
        expect(tx.getFullName()).to.be.equal('OtherTransaction/Nodejs/background:job')

        // clean up tx so it doesn't cause other problems
        tx.end()
        done()
      })
      expect(agent.tracer.getTransaction()).to.not.exist
      txHandler()
    })

    it('should create an outermost segment', (done) => {
      var txHandler = api.createBackgroundTransaction('background:job', () => {
        var tx = agent.tracer.getTransaction()
        expect(tx).to.exist

        var trace = tx.trace
        expect(trace.root.children).to.have.length(1)

        // clean up tx so it doesn't cause other problems
        tx.end()
        done()
      })

      txHandler()
    })

    describe('when a web transaction is active', () => {
      it('should create a new transaction', (done) => {
        var fn = api.createBackgroundTransaction('background:job', function(outerTx) {
          var tx = agent.tracer.getTransaction()
          expect(tx).to.have.property('id').not.equal(outerTx.id)

          var trace = tx.trace
          expect(trace.root.children).to.have.length(1)

          done()
        })

        helper.runInTransaction(agent, function(transaction) {
          transaction.type = 'web'
          fn(transaction)
          transaction.end()
        })
      })
    })

    describe('when a background transaction is active', () => {
      it('should not create a new transaction', (done) => {
        var fn = api.createBackgroundTransaction('background:job', function(outerTx) {
          var tx = agent.tracer.getTransaction()
          expect(tx).to.have.property('id', outerTx.id)

          var trace = tx.trace
          expect(trace.root.children).to.have.length(1)

          done()
        })

        helper.runInTransaction(agent, function(transaction) {
          transaction.type = 'bg'
          fn(transaction)
          transaction.end()
        })
      })

      it('should nest its segment within an in play segment', (done) => {
        var fn = api.createBackgroundTransaction('background:job', function(outerTx) {
          var tx = agent.tracer.getTransaction()
          expect(tx).to.have.property('id', outerTx.id)

          var trace = tx.trace
          expect(trace.root.children).to.have.length(1)
          var child = trace.root.children[0]
          expect(child.name).to.equal('outer')
          expect(child.children).to.have.length(1)

          done()
        })

        helper.runInTransaction(agent, function(transaction) {
          transaction.type = 'bg'
          agent.tracer.addSegment('outer', null, null, false, () => {
            fn(transaction)
            transaction.end()
          })
        })
      })
    })

    it('should be ended by calling endTransaction', (done) => {
      var txHandler = api.createWebTransaction('background:job', () => {
        var tx = agent.tracer.getTransaction()

        expect(tx.isActive()).to.be.true
        api.endTransaction()
        expect(tx.isActive()).to.be.false

        done()
      })
      txHandler()
    })

    it('should create only one rollup metric when nested', (done) => {
      var handler1 = api.createBackgroundTransaction('custom1', () => {
        handler2()
        api.endTransaction()
      })

      var handler2 = api.createBackgroundTransaction('custom2', () => {
        api.endTransaction()
      })

      handler1()

      agent.on('transactionFinished', function(tx) {
        expect(tx.metrics.getMetric('OtherTransaction/all').callCount).equal(1)
        expect(tx.metrics.getMetric('OtherTransactionTotalTime').callCount).equal(1)
        done()
      })
    })

    it('should create proper metrics with default group name', (done) => {
      var txHandler = api.createBackgroundTransaction('background:job', () => {
        var tx = agent.tracer.getTransaction()
        expect(tx).to.exist
        api.endTransaction()
      })
      expect(agent.tracer.getTransaction()).to.not.exist
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

    it('should create proper metrics with group name', (done) => {
      var txHandler = api.createBackgroundTransaction('background:job', 'thinger', () => {
        var tx = agent.tracer.getTransaction()
        expect(tx).to.exist
        api.endTransaction()
      })
      expect(agent.tracer.getTransaction()).to.not.exist
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

    it('should create a new transaction when nested within a web transaction', (done) => {
      var webHandler = api.createWebTransaction('/custom/transaction', () => {
        var tx = agent.tracer.getTransaction()
        expect(tx).to.exist
        expect(tx.url).to.equal('/custom/transaction')
        expect(tx.type).to.equal('web')
        expect(tx.baseSegment).to.exist
        var bgHandler = api.createBackgroundTransaction('background:job', () => {
          var bgTx = agent.tracer.getTransaction()
          expect(bgTx).to.exist.and.not.equal(tx)
          expect(bgTx.getFullName()).to.equal('OtherTransaction/Nodejs/background:job')
          expect(bgTx.type).to.equal('bg')
          expect(bgTx.baseSegment).to.exist
          // clean up bgTx so it doesn't cause other problems
          bgTx.end()
          done()
        })
        bgHandler()
        // clean up tx so it doesn't cause other problems
        tx.end()
      })
      expect(agent.tracer.getTransaction()).to.not.exist
      webHandler()
    })

    it('should return the any value that the hanlder returns', () => {
      var txHandler = api.createBackgroundTransaction('/custom/transaction', () => {
        return 'a thing'
      })
      var value = txHandler()
      expect(value).to.be.equal('a thing')
    })
  })

  it('endTransaction should not throw an exception if no transaction is active', () => {
    var tx = agent.tracer.getTransaction()
    expect(tx).to.not.exist
    expect(() => {
      api.endTransaction()
    }).to.not.throw()
  })
})
