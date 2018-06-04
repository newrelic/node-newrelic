'use strict'

var API = require('../../../api')
var chai = require('chai')
var DESTINATIONS = require('../../../lib/config/attribute-filter').DESTINATIONS
var should = chai.should()
var expect = chai.expect
var helper = require('../../lib/agent_helper')
var semver = require('semver')
var sinon = require('sinon')
var shimmer = require('../../../lib/shimmer')


describe('the New Relic agent API', function() {
  var URL = '/test/path/31337'
  var NAME = 'WebTransaction/Uri/test/path/31337'
  var agent
  var api


  beforeEach(function() {
    agent = helper.loadMockedAgent()
    api = new API(agent)
  })

  afterEach(function() {
    helper.unloadAgent(agent)
  })

  it("exports a transaction naming function", function() {
    should.exist(api.setTransactionName)
    expect(api.setTransactionName).to.be.a('function')
  })

  it("exports a dispatcher setter", function() {
    should.exist(api.setDispatcher)
    expect(api.setDispatcher).to.be.a('function')
  })

  describe("dispatch setter", function() {
    afterEach(function() {
      agent.environment.clearDispatcher()
    })
    it("sets the dispatcher", function() {
      api.setDispatcher('test')
      expect(agent.environment.get('Dispatcher')).to.include('test')
    })

    it("sets the dispatcher and version", function() {
      api.setDispatcher('test', 2)
      expect(agent.environment.get('Dispatcher')).to.include('test')
      expect(agent.environment.get('Dispatcher Version')).to.include('2')
    })

    it("does not allow internal calls to setDispatcher to override", function() {
      agent.environment.setDispatcher('internal', '3')
      expect(agent.environment.get('Dispatcher')).to.include('internal')
      expect(agent.environment.get('Dispatcher Version')).to.include('3')

      api.setDispatcher('test', 2)
      expect(agent.environment.get('Dispatcher')).to.include('test')
      expect(agent.environment.get('Dispatcher Version')).to.include('2')

      agent.environment.setDispatcher('internal', '3')
      expect(agent.environment.get('Dispatcher')).to.include('test')
      expect(agent.environment.get('Dispatcher Version')).to.include('2')
    })
  })

  it("exports a dispatcher setter", function() {
    should.exist(api.setDispatcher)
    expect(api.setDispatcher).to.be.a('function')
  })

  it("exports a controller naming function", function() {
    should.exist(api.setControllerName)
    expect(api.setControllerName).to.be.a('function')
  })

  it("exports a transaction ignoring function", function() {
    should.exist(api.setIgnoreTransaction)
    expect(api.setIgnoreTransaction).to.be.a('function')
  })

  it("exports a function for adding naming rules", function() {
    should.exist(api.addNamingRule)
    expect(api.addNamingRule).to.be.a('function')
  })

  it("exports a function for ignoring certain URLs", function() {
    should.exist(api.addIgnoringRule)
    expect(api.addIgnoringRule).to.be.a('function')
  })

  it("exports a function for adding custom parameters", function() {
    should.exist(api.addCustomParameter)
    expect(api.addCustomParameter).to.be.a('function')
  })

  it("exports a function for adding custom instrumentation", function() {
    should.exist(api.instrument)
    expect(api.instrument).to.be.a('function')
  })

  it("exports a function for getting a transaction handle", function() {
    should.exist(api.getTransaction)
    expect(api.getTransaction).to.be.a('function')
  })

  describe("when getting a transaction handle", function() {
    it("shoud return a stub when running outside of a transaction", function() {
      var handle = api.getTransaction()
      expect(handle.end).to.be.a('function')
      expect(handle.ignore).to.be.a('function')
      expect(handle.createDistributedTracePayload).to.be.a('function')
      expect(handle.acceptDistributedTracePayload).to.be.a('function')

      var payload = handle.createDistributedTracePayload()
      expect(payload.httpSafe).to.be.a('function')
      expect(payload.text).to.be.a('function')
    })

    it("should mark the transaction as externally handled", function(done) {
      helper.runInTransaction(agent, function(txn) {
        var handle = api.getTransaction()
        expect(txn.handledExternally).to.equal(true)
        expect(handle.end).to.be.a('function')
        handle.end()
        done()
      })
    })

    it("should return a method to ignore the transaction", function(done) {
      helper.runInTransaction(agent, function(txn) {
        var handle = api.getTransaction()
        expect(handle.ignore).to.be.a('function')
        handle.ignore()
        expect(txn.forceIgnore).to.equal(true)
        expect(handle.end).to.be.a('function')
        handle.end()
        done()
      })
    })

    it("should have a method to create a distributed trace payload", function(done) {
      helper.runInTransaction(agent, function(txn) {
        var handle = api.getTransaction()
        expect(handle.createDistributedTracePayload).to.be.a('function')
        agent.config.cross_process_id = '1234#5678'
        var distributedTracePayload = handle.createDistributedTracePayload()
        expect(distributedTracePayload.text).to.be.a('function')
        expect(distributedTracePayload.httpSafe).to.be.a('function')
        done()
      })
    })

    it("should have a method for accepting a distributed trace payload", function(done) {
      helper.runInTransaction(agent, function(txn) {
        var handle = api.getTransaction()
        expect(handle.acceptDistributedTracePayload).to.be.a('function')
        done()
      })
    })

    it("should return a handle with a method to end the transaction", function(done) {
      var transaction
      agent.on('transactionFinished', function(t) {
        expect(t.id).to.equal(transaction.id)
        done()
      })
      helper.runInTransaction(agent, function(txn) {
        transaction = txn
        var handle = api.getTransaction()
        expect(handle.end).to.be.a('function')
        handle.end()
      })
    })

    it("should call a callback when handle end is called", function(done) {
      helper.runInTransaction(agent, function() {
        var handle = api.getTransaction()
        handle.end(function() {
          done()
        })
      })
    })

    it("does not blow up when end is called without a callback", function() {
      helper.runInTransaction(agent, function() {
        var handle = api.getTransaction()
        handle.end()
      })
    })
  })


  it("exports a function for adding multiple custom attributes at once", function() {
    should.exist(api.addCustomAttributes)
    expect(api.addCustomAttributes).a('function')
  })

  describe("when adding custom attributes", function() {
    beforeEach(function() {
      agent.config.attributes.enabled = true
    })

    it('should properly add custom attributes', function() {
      helper.runInTransaction(agent, function(transaction) {
        api.addCustomAttribute('test', 1)
        var attributes = transaction.trace.custom.get(DESTINATIONS.TRANS_TRACE)
        expect(attributes.test).to.equal(1)
        transaction.end()
      })
    })

    it('should skip if attribute key length limit is exceeded', function() {
      helper.runInTransaction(agent, function(transaction) {
        var tooLong = [
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
          'Cras id lacinia erat. Suspendisse mi nisl, sodales vel est eu,',
          'rhoncus lacinia ante. Nulla tincidunt efficitur diam, eget vulputate',
          'lectus facilisis sit amet. Morbi hendrerit commodo quam, in nullam.'
        ].join(' ')
        api.addCustomAttribute(tooLong, 'will fail')
        var attributes = transaction.trace.custom.get(DESTINATIONS.TRANS_TRACE)
        expect(attributes[tooLong]).to.be.undefined
        transaction.end()
      })
    })

    it('should properly add multiple custom attributes', function() {
      helper.runInTransaction(agent, function(transaction) {
        api.addCustomAttributes({
          one: 1,
          two: 2
        })
        var attributes = transaction.trace.custom.get(DESTINATIONS.TRANS_TRACE)
        expect(attributes.one).to.equal(1)
        expect(attributes.two).to.equal(2)
        transaction.end()
      })
    })

    it('should not add custom attributes when disabled', function() {
      helper.runInTransaction(agent, function(transaction) {
        agent.config.api.custom_attributes_enabled = false
        api.addCustomAttribute('test', 1)
        var attributes = transaction.trace.custom.get(DESTINATIONS.TRANS_TRACE)
        expect(attributes.test).to.equal(undefined)
        agent.config.api.custom_attributes_enabled = true
        transaction.end()
      })
    })

    it('should not add multiple custom attributes when disabled', function() {
      helper.runInTransaction(agent, function(transaction) {
        agent.config.api.custom_attributes_enabled = false
        api.addCustomAttributes({
          one: 1,
          two: 2
        })
        var attributes = transaction.trace.custom.get(DESTINATIONS.TRANS_TRACE)
        expect(attributes.one).to.equal(undefined)
        expect(attributes.two).to.equal(undefined)
        agent.config.api.custom_attributes_enabled = true
        transaction.end()
      })
    })

    it('should not add custom attributes in high security mode', function() {
      helper.runInTransaction(agent, function(transaction) {
        agent.config.high_security = true
        api.addCustomAttribute('test', 1)
        var attributes = transaction.trace.custom.get(DESTINATIONS.TRANS_TRACE)
        expect(attributes.test).to.equal(undefined)
        agent.config.high_security = false
        transaction.end()
      })
    })

    it('should not add multiple custom attributes in high security mode', function() {
      helper.runInTransaction(agent, function(transaction) {
        agent.config.high_security = true
        api.addCustomAttributes({
          one: 1,
          two: 2
        })
        var attributes = transaction.trace.custom.get(DESTINATIONS.TRANS_TRACE)
        expect(attributes.one).to.equal(undefined)
        expect(attributes.two).to.equal(undefined)
        agent.config.high_security = false
        transaction.end()
      })
    })
  })

  describe('when creating a segment with `startSegment`', function() {
    it('should name the segment as provided', function() {
      helper.runInTransaction(agent, function() {
        api.startSegment('foobar', false, function() {
          var segment = api.shim.getSegment()
          expect(segment).to.exist.and.have.property('name', 'foobar')
        })
      })
    })

    it('should return the return value of the handler', function() {
      helper.runInTransaction(agent, function() {
        var obj = {}
        var ret = api.startSegment('foobar', false, function() {
          return obj
        })
        expect(ret).to.equal(obj)
      })
    })

    it('should not record a metric when `record` is `false`', function(done) {
      helper.runInTransaction(agent, function(tx) {
        tx.name = 'test'
        api.startSegment('foobar', false, function() {
          var segment = api.shim.getSegment()
          expect(segment).to.exist.and.have.property('name', 'foobar')
        })
        tx.end(function() {
          expect(tx.metrics.scoped).to.not.have.property(tx.name)
          expect(tx.metrics.unscoped).to.not.have.property('Custom/foobar')
          done()
        })
      })
    })

    it('should record a metric when `record` is `true`', function(done) {
      helper.runInTransaction(agent, function(tx) {
        tx.name = 'test'
        api.startSegment('foobar', true, function() {
          var segment = api.shim.getSegment()
          expect(segment).to.exist.and.have.property('name', 'foobar')
        })
        tx.end(function() {
          expect(tx.metrics.scoped).property(tx.name)
            .to.have.property('Custom/foobar')
          expect(tx.metrics.unscoped).to.have.property('Custom/foobar')
          done()
        })
      })
    })

    it('should time the segment from the callback if provided', function(done) {
      helper.runInTransaction(agent, function() {
        api.startSegment('foobar', false, function(cb) {
          var segment = api.shim.getSegment()
          setTimeout(cb, 150, null, segment)
        }, function(err, segment) {
          expect(err).to.be.null
          expect(segment).to.exist
          expect(segment.getDurationInMillis()).to.be.within(100, 200)
          done()
        })
      })
    })

    it('should time the segment from a returned promise', function() {
      return helper.runInTransaction(agent, function() {
        return api.startSegment('foobar', false, function() {
          var segment = api.shim.getSegment()
          return new Promise(function(resolve) {
            setTimeout(resolve, 150, segment)
          })
        }).then(function(segment) {
          expect(segment).to.exist
          expect(segment.getDurationInMillis()).to.be.within(100, 200)
        })
      })
    })
  })

  describe("when starting a web transaction using startWebTransaction", function() {
    var thenCalled = false
    var FakePromise = {
      then: function(f) {
        thenCalled = true
        f()
        return this
      }
    }
    var transaction

    beforeEach(function() {
      thenCalled = false
      transaction = null
    })

    it('should add nested transaction as segment to parent transaction', function() {
      api.startWebTransaction('test', function() {
        nested()
        transaction = agent.tracer.getTransaction()
        expect(transaction.type).to.equal('web')
        expect(transaction.getFullName()).to.equal('WebTransaction/Custom//test')
        expect(transaction.isActive()).to.be.true
        expect(agent.tracer.segment.children[0].name).to.equal('nested')
      })
      function nested() {
        api.startWebTransaction('nested', function() {})
      }
      expect(transaction.isActive()).to.be.false
    })

    it("should end the transaction after the handle returns by default", function() {
      api.startWebTransaction('test', function() {
        transaction = agent.tracer.getTransaction()
        expect(transaction.type).to.equal('web')
        expect(transaction.getFullName()).to.equal('WebTransaction/Custom//test')
        expect(transaction.isActive()).to.be.true
      })
      expect(transaction.isActive()).to.be.false
    })

    it("should end the transaction after a promise returned by the transaction function resolves", function() {
      api.startWebTransaction('test', function() {
        transaction = agent.tracer.getTransaction()
        expect(transaction.type).to.equal('web')
        expect(transaction.getFullName()).to.equal('WebTransaction/Custom//test')
        expect(transaction.isActive()).to.be.true
        expect(thenCalled).to.be.false
        return FakePromise
      })
      expect(thenCalled).to.be.true
      expect(transaction.isActive()).to.be.false
    })

    it("should not end the transaction if the transaction is being handled externally", function() {
      api.startWebTransaction('test', function() {
        transaction = agent.tracer.getTransaction()
        expect(transaction.type).to.equal('web')
        expect(transaction.getFullName()).to.equal('WebTransaction/Custom//test')
        expect(transaction.isActive()).to.be.true
        transaction.handledExternally = true
      })
      expect(transaction.isActive()).to.be.true
      transaction.end()
    })

    it("should call the handler if no url is supplied", function(done) {
      api.startWebTransaction(null, function() {
        transaction = agent.tracer.getTransaction()
        expect(transaction).to.be.null
        done()
      })
    })

    it("should not throw when no handler is supplied", function() {
      expect(function() { api.startWebTransaction('test') }).to.not.throw()
    })
  })

  describe("when starting a background transaction using startBackgroundTransaction", function() {
    var thenCalled = false
    var FakePromise = {
      then: function(f) {
        thenCalled = true
        f()
        return this
      }
    }
    var transaction

    beforeEach(function() {
      thenCalled = false
      transaction = null
    })

    it('should add nested transaction as segment to parent transaction', function() {
      api.startBackgroundTransaction('test', function() {
        nested()
        transaction = agent.tracer.getTransaction()
        expect(transaction.type).to.equal('bg')
        expect(transaction.getFullName()).to.equal('OtherTransaction/Nodejs/test')
        expect(transaction.isActive()).to.be.true
        expect(agent.tracer.segment.children[0].name).to.equal('Nodejs/nested')
      })
      function nested() {
        api.startBackgroundTransaction('nested', function() {})
      }
      expect(transaction.isActive()).to.be.false
    })

    it("should end the transaction after the handle returns by default", function() {
      api.startBackgroundTransaction('test', function() {
        transaction = agent.tracer.getTransaction()
        expect(transaction.type).to.equal('bg')
        expect(transaction.getFullName()).to.equal('OtherTransaction/Nodejs/test')
        expect(transaction.isActive()).to.be.true
      })
      expect(transaction.isActive()).to.be.false
    })

    it("should be namable with setTransactionName", function() {
      var handle
      api.startBackgroundTransaction('test', function() {
        transaction = agent.tracer.getTransaction()
        handle = api.getTransaction()
        api.setTransactionName('custom name')
        expect(transaction.type).to.equal('bg')
        expect(transaction.getFullName()).to.equal('OtherTransaction/Custom/custom name')
        expect(transaction.isActive()).to.be.true
      })
      process.nextTick(function() {
        handle.end()
        expect(transaction.isActive()).to.be.false
        expect(transaction.getFullName()).to.equal('OtherTransaction/Custom/custom name')
      })
    })


    it("should start a background transaction with the given name as the name and group", function() {
      api.startBackgroundTransaction('test', 'group', function() {
        transaction = agent.tracer.getTransaction()
        expect(transaction.type).to.equal('bg')
        expect(transaction.getFullName()).to.equal('OtherTransaction/group/test')
        expect(transaction.isActive()).to.be.true
      })
      expect(transaction.isActive()).to.be.false
    })

    it("should end the transaction after a promise returned by the transaction function resolves", function() {
      api.startBackgroundTransaction('test', function() {
        transaction = agent.tracer.getTransaction()
        expect(transaction.type).to.equal('bg')
        expect(transaction.getFullName()).to.equal('OtherTransaction/Nodejs/test')
        expect(transaction.isActive()).to.be.true
        expect(thenCalled).to.be.false
        return FakePromise
      })
      expect(thenCalled).to.be.true
      expect(transaction.isActive()).to.be.false
    })

    it("should not end the transaction if the transaction is being handled externally", function() {
      api.startBackgroundTransaction('test', function() {
        transaction = agent.tracer.getTransaction()
        expect(transaction.type).to.equal('bg')
        expect(transaction.getFullName()).to.equal('OtherTransaction/Nodejs/test')
        expect(transaction.isActive()).to.be.true
        transaction.handledExternally = true
      })
      expect(transaction.isActive()).to.be.true
      transaction.end()
    })

    it("should call the handler if no name is supplied", function(done) {
      api.startBackgroundTransaction(null, function() {
        transaction = agent.tracer.getTransaction()
        expect(transaction).to.be.null
        done()
      })
    })

    it("should not throw when no handler is supplied", function() {
      expect(function() { api.startBackgroundTransaction('test') }).to.not.throw()
      expect(function() { api.startBackgroundTransaction('test', 'asdf') }).to.not.throw()
      expect(function() {
        api.startBackgroundTransaction('test', 'asdf', 'not a function')
      }).to.not.throw()
    })
  })

  describe("when explicitly naming transactions", function() {
    describe("in the simplest case", function() {
      var segment
      var transaction

      beforeEach(function(done) {
        agent.on('transactionFinished', function(t) {
          // grab transaction
          transaction = t
          transaction.finalizeNameFromUri(URL, 200)
          segment.markAsWeb(URL)
          done()
        })

        helper.runInTransaction(agent, function(tx) {
          // grab segment
          agent.tracer.addSegment(NAME, null, null, false, function() {
            // HTTP instrumentation sets URL as soon as it knows it
            segment = agent.tracer.getSegment()
            tx.type = 'web'
            tx.url = URL
            tx.verb = 'POST'

            // Name the transaction
            api.setTransactionName('Test')

            tx.end()
          })
        })
      })

      it("sets the transaction name to the custom name", function() {
        expect(transaction.name).equal('WebTransaction/Custom/Test')
      })

      it("names the web trace segment after the custom name", function() {
        expect(segment.name).equal('WebTransaction/Custom/Test')
      })

      it("leaves the request URL alone", function() {
        expect(transaction.url).equal(URL)
      })
    })

    it("uses the last name set when called multiple times", function(done) {
      agent.on('transactionFinished', function(transaction) {
        transaction.finalizeNameFromUri(URL, 200)

        expect(transaction.name).equal('WebTransaction/Custom/List')

        done()
      })

      helper.runInTransaction(agent, function(transaction) {
        agent.tracer.createSegment(NAME)
        transaction.url  = URL
        transaction.verb = 'GET'

        // NAME THE CONTROLLER AND ACTION, MULTIPLE TIMES
        api.setTransactionName('Index')
        api.setTransactionName('Update')
        api.setTransactionName('Delete')
        api.setTransactionName('List')

        transaction.end()
      })
    })
  })

  describe("when (not) ignoring a transaction", function() {
    it("should mark the transaction ignored", function(done) {
      agent.on('transactionFinished', function(transaction) {
        transaction.finalizeNameFromUri(URL, 200)

        expect(transaction.ignore).equal(true)

        done()
      })

      helper.runInTransaction(agent, function(transaction) {
        agent.tracer.createSegment(NAME)
        transaction.url  = URL
        transaction.verb = 'GET'

        api.setIgnoreTransaction(true)

        transaction.end()
      })
    })

    it("should force a transaction to not be ignored", function(done) {
      api.addIgnoringRule('^/test/.*')

      agent.on('transactionFinished', function(transaction) {
        transaction.finalizeNameFromUri(URL, 200)

        expect(transaction.ignore).equal(false)

        done()
      })

      helper.runInTransaction(agent, function(transaction) {
        agent.tracer.createSegment(NAME)
        transaction.url = URL
        transaction.verb = 'GET'

        api.setIgnoreTransaction(false)

        transaction.end()
      })
    })
  })

  describe("when explicitly naming controllers", function() {
    describe("in the simplest case", function() {
      var segment
      var transaction


      beforeEach(function(done) {
        agent.on('transactionFinished', function(t) {
          // grab transaction
          transaction = t
          t.finalizeNameFromUri(URL, 200)
          segment.markAsWeb(URL)
          done()
        })

        helper.runInTransaction(agent, function(tx) {
          // grab segment
          agent.tracer.addSegment(NAME, null, null, false, function() {
            // HTTP instrumentation sets URL as soon as it knows it
            segment = agent.tracer.getSegment()
            tx.url = URL
            tx.verb = 'POST'

            // NAME THE CONTROLLER
            api.setControllerName('Test')

            tx.end()
          })
        })
      })

      it("sets the controller in the transaction name", function() {
        expect(transaction.name).equal('WebTransaction/Controller/Test/POST')
      })

      it("names the web trace segment after the controller", function() {
        expect(segment.name).equal('WebTransaction/Controller/Test/POST')
      })

      it("leaves the request URL alone", function() {
        expect(transaction.url).equal(URL)
      })
    })

    it("uses the HTTP verb for the default action", function(done) {
      agent.on('transactionFinished', function(transaction) {
        transaction.finalizeNameFromUri(URL, 200)

        expect(transaction.name).equal('WebTransaction/Controller/Test/DELETE')

        done()
      })

      helper.runInTransaction(agent, function(transaction) {
        agent.tracer.createSegment(NAME)
        transaction.url = URL

        // SET THE ACTION
        transaction.verb = 'DELETE'

        // NAME THE CONTROLLER
        api.setControllerName('Test')

        transaction.end()
      })
    })

    it("allows a custom action", function(done) {
      agent.on('transactionFinished', function(transaction) {
        transaction.finalizeNameFromUri(URL, 200)

        expect(transaction.name).equal('WebTransaction/Controller/Test/index')

        done()
      })

      helper.runInTransaction(agent, function(transaction) {
        agent.tracer.createSegment(NAME)
        transaction.url = URL
        transaction.verb = 'GET'

        // NAME THE CONTROLLER AND ACTION
        api.setControllerName('Test', 'index')

        transaction.end()
      })
    })

    it("uses the last controller set when called multiple times", function(done) {
      agent.on('transactionFinished', function(transaction) {
        transaction.finalizeNameFromUri(URL, 200)

        expect(transaction.name).equal('WebTransaction/Controller/Test/list')

        done()
      })

      helper.runInTransaction(agent, function(transaction) {
        agent.tracer.createSegment(NAME)
        transaction.url = URL
        transaction.verb = 'GET'

        // NAME THE CONTROLLER AND ACTION, MULTIPLE TIMES
        api.setControllerName('Test', 'index')
        api.setControllerName('Test', 'update')
        api.setControllerName('Test', 'delete')
        api.setControllerName('Test', 'list')

        transaction.end()
      })
    })
  })

  describe('when adding a custom attribute', function() {
    beforeEach(function() {
      agent.config.attributes.enabled = true
    })

    describe('inside a transaction', function() {
      it('should have set the value properly', function(done) {
        agent.on('transactionFinished', function(transaction) {
          var attributes = transaction.trace.custom.get(DESTINATIONS.TRANS_TRACE)
          expect(attributes.TestName).equal('TestValue')

          done()
        })

        helper.runInTransaction(agent, function(transaction) {
          api.addCustomAttribute('TestName', 'TestValue')

          transaction.end()
        })
      })

      it("should keep the most-recently seen value", function(done) {
        agent.on('transactionFinished', function(transaction) {
          var attributes = transaction.trace.custom.get(DESTINATIONS.TRANS_TRACE)
          expect(attributes.TestName).equal('Third')

          done()
        })

        helper.runInTransaction(agent, function(transaction) {
          api.addCustomAttribute('TestName', 'TestValue')
          api.addCustomAttribute('TestName', 'Second')
          api.addCustomAttribute('TestName', 'Third')

          transaction.end()
        })
      })

      it('should roll with it if custom attributes are gone', function() {
        helper.runInTransaction(agent, function(transaction) {
          var trace = transaction.trace
          delete trace.custom
          expect(function() {
            api.addCustomAttribute('TestName', 'TestValue')
          }).not.throws()
        })
      })

      it('should not allow setting of excluded attributes', function(done) {
        agent.config.attributes.exclude.push('ignore_me')
        agent.config.emit('attributes.exclude')

        agent.on('transactionFinished', function(transaction) {
          var attributes = transaction.trace.custom.get(DESTINATIONS.TRANS_TRACE)
          expect(attributes).to.not.have.property('ignore_me')

          done()
        })

        helper.runInTransaction(agent, function(transaction) {
          api.addCustomAttribute('ignore_me', 'set')

          transaction.end()
        })
      })
    })

    describe('outside a transaction', function() {
      it("shouldn't blow up", function() {
        expect(function() {
          api.addCustomAttribute('TestName', 'TestValue')
        }).not.throws()
      })
    })
  })

  describe("when handed a new naming rule", function() {
    it("should add it to the agent's normalizer", function() {
      expect(agent.userNormalizer.rules.length).equal(1) // default ignore rule
      api.addNamingRule('^/simple.*', 'API')
      expect(agent.userNormalizer.rules.length).equal(2)
    })

    describe("in the base case", function() {
      var mine
      beforeEach(function() {
        agent.urlNormalizer.load([
          {each_segment : true, eval_order : 0, terminate_chain : false,
           match_expression : '^(test_match_nothing)$',
           replace_all : false, ignore : false, replacement : '\\1'},
          {each_segment : true, eval_order : 1, terminate_chain : false,
           match_expression : '^[0-9][0-9a-f_,.-]*$',
           replace_all : false, ignore : false, replacement : '*'},
          {each_segment : false, eval_order : 2, terminate_chain : false,
           match_expression : '^(.*)/[0-9][0-9a-f_,-]*\\.([0-9a-z][0-9a-z]*)$',
           replace_all : false, ignore : false, replacement : '\\1/.*\\2'}
        ])

        api.addNamingRule('^/test/.*', 'Test')
        mine = agent.userNormalizer.rules[0]
      })

      it("should add it to the agent's normalizer", function() {
        expect(agent.urlNormalizer.rules.length).equal(3)
        expect(agent.userNormalizer.rules.length).equal(1 + 1) // +1 default rule
      })

      it("should leave the passed-in pattern alone", function() {
        if (semver.satisfies(process.versions.node, '>=1.0.0')) {
          expect(mine.pattern.source).equal('^\\/test\\/.*')
        } else {
          expect(mine.pattern.source).equal('^/test/.*')
        }
      })

      it("should have the correct replacement", function() {
        expect(mine.replacement).equal('/Test')
      })

      it("should set it to highest precedence", function() {
        expect(mine.precedence).equal(0)
      })

      it("should end further normalization", function() {
        expect(mine.isTerminal).equal(true)
      })

      it("should only apply it to the whole URL", function() {
        expect(mine.eachSegment).equal(false)
      })
    })

    it("applies a string pattern correctly", function(done) {
      api.addNamingRule('^/test/.*', 'Test')

      agent.on('transactionFinished', function(transaction) {
        transaction.finalizeNameFromUri(URL, 200)

        expect(transaction.name).equal('WebTransaction/NormalizedUri/Test')

        done()
      })

      helper.runInTransaction(agent, function(transaction) {
        agent.tracer.createSegment(NAME)
        transaction.url = URL
        transaction.verb = 'GET'

        transaction.end()
      })
    })

    it("applies a regex pattern with capture groups correctly", function(done) {
      api.addNamingRule(/^\/test\/(.*)\/(.*)/, 'Test/$2')

      agent.on('transactionFinished', function(transaction) {
        transaction.finalizeNameFromUri('/test/31337/related', 200)

        expect(transaction.name).equal('WebTransaction/NormalizedUri/Test/related')

        done()
      })

      helper.runInTransaction(agent, function(transaction) {
        agent.tracer.createSegment(NAME)
        transaction.url = '/test/31337/related'
        transaction.verb = 'GET'

        transaction.end()
      })
    })
  })

  describe("when handed a new pattern to ignore", function() {
    it("should add it to the agent's normalizer", function() {
      expect(agent.userNormalizer.rules.length).equal(1) // default ignore rule
      api.addIgnoringRule('^/simple.*')
      expect(agent.userNormalizer.rules.length).equal(2)
    })

    describe("in the base case", function() {
      var mine
      beforeEach(function() {
        agent.urlNormalizer.load([
          {each_segment : true, eval_order : 0, terminate_chain : false,
           match_expression : '^(test_match_nothing)$',
           replace_all : false, ignore : false, replacement : '\\1'},
          {each_segment : true, eval_order : 1, terminate_chain : false,
           match_expression : '^[0-9][0-9a-f_,.-]*$',
           replace_all : false, ignore : false, replacement : '*'},
          {each_segment : false, eval_order : 2, terminate_chain : false,
           match_expression : '^(.*)/[0-9][0-9a-f_,-]*\\.([0-9a-z][0-9a-z]*)$',
           replace_all : false, ignore : false, replacement : '\\1/.*\\2'}
        ])

        api.addIgnoringRule('^/test/.*')
        mine = agent.userNormalizer.rules[0]
      })

      it("should add it to the agent's normalizer", function() {
        expect(agent.urlNormalizer.rules.length).equal(3)
        expect(agent.userNormalizer.rules.length).equal(1 + 1) // +1 default rule
      })

      it("should leave the passed-in pattern alone", function() {
        if (semver.satisfies(process.versions.node, '>=1.0.0')) {
          expect(mine.pattern.source).equal('^\\/test\\/.*')
        } else {
          expect(mine.pattern.source).equal('^/test/.*')
        }
      })

      it("should have the correct replacement", function() {
        expect(mine.replacement).equal('$0')
      })

      it("should set it to highest precedence", function() {
        expect(mine.precedence).equal(0)
      })

      it("should end further normalization", function() {
        expect(mine.isTerminal).equal(true)
      })

      it("should only apply it to the whole URL", function() {
        expect(mine.eachSegment).equal(false)
      })

      it("should ignore transactions related to that URL", function() {
        expect(mine.ignore).equal(true)
      })
    })

    it("applies a string pattern correctly", function(done) {
      api.addIgnoringRule('^/test/.*')

      agent.on('transactionFinished', function(transaction) {
        transaction.finalizeNameFromUri(URL, 200)

        expect(transaction.ignore).equal(true)

        done()
      })

      helper.runInTransaction(agent, function(transaction) {
        agent.tracer.createSegment(NAME)
        transaction.url = URL
        transaction.verb = 'GET'

        transaction.end()
      })
    })
  })

  describe("when handed an error to trace", function() {
    beforeEach(function() {
      agent.config.attributes.enabled = true
    })

    it("should add the error even without a transaction", function() {
      expect(agent.errors.errors.length).equal(0)
      api.noticeError(new TypeError('this test is bogus, man'))
      expect(agent.errors.errors.length).equal(1)
    })

    it("should not add errors in high security mode", function() {
      agent.config.high_security = true
      expect(agent.errors.errors.length).equal(0)
      api.noticeError(new TypeError('this test is bogus, man'))
      expect(agent.errors.errors.length).equal(0)
      agent.config.high_security = false
    })

    it("should not add errors when noticeErrors is disabled", function() {
      agent.config.api.notice_error_enabled = false
      expect(agent.errors.errors.length).equal(0)
      api.noticeError(new TypeError('this test is bogus, man'))
      expect(agent.errors.errors.length).equal(0)
      agent.config.api.notice_error_enabled = true
    })

    it("should track custom parameters on error without a transaction", function() {
      expect(agent.errors.errors.length).equal(0)
      api.noticeError(new TypeError('this test is bogus, man'), {present : 'yep'})
      expect(agent.errors.errors.length).equal(1)

      var params = agent.errors.errors[0][4]
      expect(params.userAttributes.present).equal('yep')
    })

    it('should respect attribute filter rules', function() {
      agent.config.attributes.exclude.push('unwanted')
      agent.config.emit('attributes.exclude')
      expect(agent.errors.errors.length).equal(0)
      api.noticeError(
        new TypeError('this test is bogus, man'),
        {present: 'yep', unwanted: 'nope'}
      )
      expect(agent.errors.errors.length).equal(1)

      var params = agent.errors.errors[0][4]
      expect(params.userAttributes.present).equal('yep')
      expect(params.userAttributes.unwanted).to.be.undefined
    })

    it("should add the error associated to a transaction", function(done) {
      expect(agent.errors.errors.length).to.equal(0)

      agent.on('transactionFinished', function(transaction) {
        expect(agent.errors.errors.length).to.equal(1)
        var caught = agent.errors.errors[0]
        expect(caught[1], 'transaction name').to.equal('Unknown')
        expect(caught[2], 'message').to.equal('test error')
        expect(caught[3], 'type').to.equal('TypeError')

        expect(transaction.ignore).equal(false)

        done()
      })

      helper.runInTransaction(agent, function(transaction) {
        api.noticeError(new TypeError('test error'))
        transaction.end()
      })
    })

    it('should notice custom attributes associated with an error', function(done) {
      expect(agent.errors.errors.length).equal(0)
      var orig = agent.config.attributes.exclude
      agent.config.attributes.exclude = ['ignored']
      agent.config.emit('attributes.exclude')

      agent.on('transactionFinished', function(transaction) {
        expect(agent.errors.errors.length).equal(1)
        var caught = agent.errors.errors[0]
        expect(caught[1]).equal('Unknown')
        expect(caught[2]).equal('test error')
        expect(caught[3]).equal('TypeError')
        expect(caught[4].userAttributes.hi).equal('yo')
        expect(caught[4].ignored).to.be.undefined

        expect(transaction.ignore).equal(false)

        agent.config.attributes.exclude = orig
        done()
      })

      helper.runInTransaction(agent, function(transaction) {
        api.noticeError(new TypeError('test error'), {hi: 'yo', ignored: 'yup'})
        transaction.end()
      })
    })

    it("should add an error-alike with a message but no stack", function(done) {
      expect(agent.errors.errors.length).equal(0)

      agent.on('transactionFinished', function(transaction) {
        expect(agent.errors.errors.length).equal(1)
        var caught = agent.errors.errors[0]
        expect(caught[1]).equal('Unknown')
        expect(caught[2]).equal('not an Error')
        expect(caught[3]).equal('Object')

        expect(transaction.ignore).equal(false)

        done()
      })

      helper.runInTransaction(agent, function(transaction) {
        api.noticeError({message : 'not an Error'})
        transaction.end()
      })
    })

    it("should add an error-alike with a stack but no message", function(done) {
      expect(agent.errors.errors.length).equal(0)

      agent.on('transactionFinished', function(transaction) {
        expect(agent.errors.errors.length).equal(1)
        var caught = agent.errors.errors[0]
        expect(caught[1]).equal('Unknown')
        expect(caught[2]).equal('')
        expect(caught[3]).equal('Error')

        expect(transaction.ignore).equal(false)

        done()
      })

      helper.runInTransaction(agent, function(transaction) {
        api.noticeError({stack : new Error().stack})
        transaction.end()
      })
    })

    it("shouldn't throw on (or capture) a useless error object", function(done) {
      expect(agent.errors.errors.length).equal(0)

      agent.on('transactionFinished', function(transaction) {
        expect(agent.errors.errors.length).equal(0)
        expect(transaction.ignore).equal(false)

        done()
      })

      helper.runInTransaction(agent, function(transaction) {
        expect(function() { api.noticeError({}) }).not.throws()
        transaction.end()
      })
    })

    it("should add a string error associated to a transaction", function(done) {
      expect(agent.errors.errors.length).equal(0)

      agent.on('transactionFinished', function(transaction) {
        expect(agent.errors.errors.length).equal(1)
        var caught = agent.errors.errors[0]
        expect(caught[1]).equal('Unknown')
        expect(caught[2]).equal('busted, bro')
        expect(caught[3]).equal('Error')

        expect(transaction.ignore).equal(false)

        done()
      })

      helper.runInTransaction(agent, function(transaction) {
        api.noticeError('busted, bro')
        transaction.end()
      })
    })

    it("should allow custom parameters to be added to string errors", function(done) {
      expect(agent.errors.errors.length).equal(0)

      agent.on('transactionFinished', function(transaction) {
        expect(agent.errors.errors.length).equal(1)
        var caught = agent.errors.errors[0]
        expect(caught[2]).equal('busted, bro')
        expect(caught[4].userAttributes.a).equal(1)
        expect(caught[4].userAttributes.steak).equal('sauce')

        expect(transaction.ignore).equal(false)

        done()
      })

      helper.runInTransaction(agent, function(transaction) {
        api.noticeError('busted, bro', {a : 1, steak : 'sauce'})
        transaction.end()
      })
    })
  })

  describe('when recording custom metrics', function() {
    it('it should aggregate metric values', function() {
      agent.config.feature_flag.custom_metrics = true
      api.recordMetric('/Custom/metric/thing', 3)
      api.recordMetric('/Custom/metric/thing', 4)
      api.recordMetric('/Custom/metric/thing', 5)

      var metric = api.agent.metrics.getMetric('/Custom/metric/thing')

      expect(metric.total).equal(12)
      expect(metric.totalExclusive).equal(12)
      expect(metric.min).equal(3)
      expect(metric.max).equal(5)
      expect(metric.sumOfSquares).equal(50)
      expect(metric.callCount).equal(3)
      agent.config.feature_flag.custom_metrics = false
    })

    it('it should merge metrics', function() {
      agent.config.feature_flag.custom_metrics = true
      api.recordMetric('/Custom/metric/thing', 3)
      api.recordMetric('/Custom/metric/thing', {
        total: 9,
        min: 4,
        max: 5,
        sumOfSquares: 41,
        count: 2
      })

      var metric = api.agent.metrics.getMetric('/Custom/metric/thing')

      expect(metric.total).equal(12)
      expect(metric.totalExclusive).equal(12)
      expect(metric.min).equal(3)
      expect(metric.max).equal(5)
      expect(metric.sumOfSquares).equal(50)
      expect(metric.callCount).equal(3)
      agent.config.feature_flag.custom_metrics = false
    })

    it('it should increment properly', function() {
      agent.config.feature_flag.custom_metrics = true
      api.incrementMetric('/Custom/metric/thing')
      api.incrementMetric('/Custom/metric/thing')
      api.incrementMetric('/Custom/metric/thing')

      var metric = api.agent.metrics.getMetric('/Custom/metric/thing')

      expect(metric.total).equal(0)
      expect(metric.totalExclusive).equal(0)
      expect(metric.min).equal(0)
      expect(metric.max).equal(0)
      expect(metric.sumOfSquares).equal(0)
      expect(metric.callCount).equal(3)

      api.incrementMetric('/Custom/metric/thing', 4)
      api.incrementMetric('/Custom/metric/thing', 5)


      expect(metric.total).equal(0)
      expect(metric.totalExclusive).equal(0)
      expect(metric.min).equal(0)
      expect(metric.max).equal(0)
      expect(metric.sumOfSquares).equal(0)
      expect(metric.callCount).equal(12)
      agent.config.feature_flag.custom_metrics = false
    })

    it('should not blow up when disabled', function() {
      agent.config.feature_flag.custom_metrics = false
      api.incrementMetric('/Custom/metric/thing')
      api.recordMetric('/Custom/metric/thing', 3)
    })
  })

  describe('shutdown', function() {
    it('exports a shutdown function', function() {
      should.exist(api.shutdown)
      expect(api.shutdown).a('function')
    })

    it('calls agent stop', function() {
      var mock = sinon.mock(agent)
      mock.expects('stop').once()
      api.shutdown()
      mock.verify()
    })

    it('calls harvest when options.collectPendingData is true and state is "started"', function() {
      var mock = sinon.mock(agent)
      agent.setState('started')
      mock.expects('harvest').once()
      api.shutdown({collectPendingData: true})
      mock.verify()
    })

    it('calls harvest when options.collectPendingData is true ' +
       'and state is not "started" and changes to "started"', function() {
      var mock = sinon.mock(agent)
      agent.setState('starting')
      mock.expects('harvest').once()
      api.shutdown({collectPendingData: true})
      agent.setState('started')
      mock.verify()
    })

    it('does not call harvest when options.collectPendingData is true ' +
       'and state is not "started" and not changed', function() {
      var mock = sinon.mock(agent)
      agent.setState('starting')
      mock.expects('harvest').never()
      api.shutdown({collectPendingData: true})
      mock.verify()
    })

    it('calls stop when options.collectPendingData is true, timeout is not given ' +
       'and state is not "started" and changes to "errored"', function() {
      var mock = sinon.mock(agent)
      agent.setState('starting')
      mock.expects('stop').once()
      api.shutdown({collectPendingData: true})
      agent.setState('errored')
      mock.verify()
    })

    it('calls stop when options.collectPendingData is true, timeout is given ' +
       'and state is not "started" and changes to "errored"', function() {
      var mock = sinon.mock(agent)
      agent.setState('starting')
      mock.expects('stop').once()
      api.shutdown({collectPendingData: true, timeout: 1000})
      agent.setState('errored')
      mock.verify()
    })

    it('calls harvest when a timeout is given and not reached', function() {
      var mock = sinon.mock(agent)
      agent.setState('starting')
      mock.expects('harvest').once()
      api.shutdown({collectPendingData: true, timeout: 1000})
      agent.setState('started')
      mock.verify()
    })

    it('calls stop when timeout is reached and does not harvest', function() {
      var mock = sinon.mock(agent)
      agent.setState('starting')
      mock.expects('harvest').never()
      mock.expects('stop').once()
      api.shutdown({collectPendingData: true, timeout: 1000}, function() {
        mock.verify()
      })
    })

    it('calls harvest when timeout is not a number', function() {
      var mock = sinon.mock(agent)
      agent.setState('starting')
      mock.expects('harvest').once()
      api.shutdown({collectPendingData: true, timeout: "xyz"}, function() {
        mock.verify()
      })
    })

    it('does not error when timeout is not a number', function() {
      var mock = sinon.mock(agent)
      agent.setState('starting')

      var shutdown = function() {
        api.shutdown({collectPendingData: true, timeout: "abc"})
      }

      expect(shutdown).to.not.throw(Error)
      mock.verify()
    })

    it('calls stop after harvest', function() {
      var mock = sinon.mock(agent)

      agent.harvest = function(cb) {
        process.nextTick(cb)
      }

      mock.expects('stop').once()
      api.shutdown({collectPendingData: true}, function() {
        mock.verify()
      })
    })

    it('calls stop when harvest errors', function() {
      var mock = sinon.mock(agent)

      agent.harvest = function(cb) {
        process.nextTick(function() {
          cb(new Error('some error'))
        })
      }

      mock.expects('stop').once()
      api.shutdown({collectPendingData: true}, function() {
        mock.verify()
      })
    })

    it('accepts callback as second argument', function() {
      agent.stop = function(cb) {
        cb()
      }
      var callback = sinon.spy()
      api.shutdown({}, callback)
      expect(callback.called).to.be.true
    })

    it('accepts callback as first argument', function() {
      agent.stop = function(cb) {
        cb()
      }
      var callback = sinon.spy()
      api.shutdown(callback)
      expect(callback.called).to.be.true
    })

    it('does not error when no callback is provided', function() {
      expect(function() { api.shutdown() }).not.throws()
    })
  })

  describe('instrument', function() {
    beforeEach(function() {
      sinon.spy(shimmer, 'registerInstrumentation')
    })

    afterEach(function() {
      shimmer.registerInstrumentation.restore()
    })

    it('should register the instrumentation with shimmer', function() {
      var opts = {
        moduleName: 'foobar',
        onRequire: function() {}
      }
      api.instrument(opts)

      expect(shimmer.registerInstrumentation.calledOnce).to.be.true
      var args = shimmer.registerInstrumentation.getCall(0).args
      expect(args[0]).to.equal(opts)
    })

    it('should convert separate args into an options object', function() {
      function onRequire() {}
      function onError() {}
      api.instrument('foobar', onRequire, onError)

      var opts = shimmer.registerInstrumentation.getCall(0).args[0]
      expect(opts).to.have.property('moduleName', 'foobar')
      expect(opts).to.have.property('onRequire', onRequire)
      expect(opts).to.have.property('onError', onError)
    })
  })

  describe('instrumentDatastore', function() {
    beforeEach(function() {
      sinon.spy(shimmer, 'registerInstrumentation')
    })

    afterEach(function() {
      shimmer.registerInstrumentation.restore()
    })

    it('should register the instrumentation with shimmer', function() {
      var opts = {
        moduleName: 'foobar',
        onRequire: function() {}
      }
      api.instrumentDatastore(opts)

      expect(shimmer.registerInstrumentation.calledOnce).to.be.true
      var args = shimmer.registerInstrumentation.getCall(0).args
      expect(args[0]).to.equal(opts)
        .and.have.property('type', 'datastore')
    })

    it('should convert separate args into an options object', function() {
      function onRequire() {}
      function onError() {}
      api.instrumentDatastore('foobar', onRequire, onError)

      var opts = shimmer.registerInstrumentation.getCall(0).args[0]
      expect(opts).to.have.property('moduleName', 'foobar')
      expect(opts).to.have.property('onRequire', onRequire)
      expect(opts).to.have.property('onError', onError)
    })
  })

  describe('instrumentWebframework', function() {
    beforeEach(function() {
      sinon.spy(shimmer, 'registerInstrumentation')
    })

    afterEach(function() {
      shimmer.registerInstrumentation.restore()
    })

    it('should register the instrumentation with shimmer', function() {
      var opts = {
        moduleName: 'foobar',
        onRequire: function() {}
      }
      api.instrumentWebframework(opts)

      expect(shimmer.registerInstrumentation.calledOnce).to.be.true
      var args = shimmer.registerInstrumentation.getCall(0).args
      expect(args[0]).to.equal(opts)
        .and.have.property('type', 'web-framework')
    })

    it('should convert separate args into an options object', function() {
      function onRequire() {}
      function onError() {}
      api.instrumentWebframework('foobar', onRequire, onError)

      var opts = shimmer.registerInstrumentation.getCall(0).args[0]
      expect(opts).to.have.property('moduleName', 'foobar')
      expect(opts).to.have.property('onRequire', onRequire)
      expect(opts).to.have.property('onError', onError)
    })
  })
})
