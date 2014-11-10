'use strict'

var path   = require('path')
  , chai   = require('chai')
  , should = chai.should()
  , expect = chai.expect
  , helper = require('../../lib/agent_helper.js')
  , API    = require('../../../api.js')


describe("the New Relic agent API", function () {
  var URL     = '/test/path/31337'
    , NAME    = 'WebTransaction/Uri/test/path/31337'
    , agent
    , api


  beforeEach(function () {
    agent = helper.loadMockedAgent()
    api = new API(agent)
  })

  afterEach(function () {
    helper.unloadAgent(agent)
  })

  it("exports a transaction naming function", function () {
    should.exist(api.setTransactionName)
    expect(api.setTransactionName).a('function')
  })

  it("exports a controller naming function", function () {
    should.exist(api.setControllerName)
    expect(api.setControllerName).a('function')
  })

  it("exports a transaction ignoring function", function () {
    should.exist(api.setIgnoreTransaction)
    expect(api.setIgnoreTransaction).a('function')
  })

  it("exports a function for adding naming rules", function () {
    should.exist(api.addNamingRule)
    expect(api.addNamingRule).a('function')
  })

  it("exports a function for ignoring certain URLs", function () {
    should.exist(api.addIgnoringRule)
    expect(api.addIgnoringRule).a('function')
  })

  it("exports a function for adding custom parameters", function () {
    should.exist(api.addCustomParameter)
    expect(api.addCustomParameter).a('function')
  })

  describe("when explicitly naming transactions", function () {
    describe("in the simplest case", function () {
      var segment
        , transaction


      beforeEach(function (done) {
        agent.on('transactionFinished', function (t) {
          // grab transaction
          transaction = t
          transaction.setName(URL, 200)
          segment.markAsWeb(URL)
          done()
        })

        helper.runInTransaction(agent, function (transaction) {
          // grab segment
          segment = agent.tracer.addSegment(NAME)

          // HTTP instrumentation sets URL as soon as it knows it
          transaction.url = URL
          transaction.verb = 'POST'

          // NAME THE TRANSACTION
          api.setTransactionName('Test')

          transaction.end()
        })
      })

      it("sets the transaction name to the custom name", function () {
        expect(transaction.name).equal('WebTransaction/Custom/Test')
      })

      it("names the web trace segment after the custom name", function () {
        expect(segment.name).equal('WebTransaction/Custom/Test')
      })

      it("leaves the request URL alone", function () {
        expect(transaction.url).equal(URL)
      })
    })

    it("uses the last name set when called multiple times", function (done) {
      var segment

      agent.on('transactionFinished', function (transaction) {
        transaction.setName(URL, 200)

        expect(transaction.name).equal('WebTransaction/Custom/List')

        done()
      })

      helper.runInTransaction(agent, function (transaction) {
        segment          = agent.tracer.addSegment(NAME)
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

  describe("when (not) ignoring a transaction", function () {
    it("should mark the transaction ignored", function (done) {
      agent.on('transactionFinished', function (transaction) {
        transaction.setName(URL, 200)

        expect(transaction.ignore).equal(true)

        done()
      })

      helper.runInTransaction(agent, function (transaction) {
        agent.tracer.addSegment(NAME)
        transaction.url  = URL
        transaction.verb = 'GET'

        api.setIgnoreTransaction(true)

        transaction.end()
      })
    })

    it("should force a transaction to not be ignored", function (done) {
      var segment

      api.addIgnoringRule('^/test/.*')

      agent.on('transactionFinished', function (transaction) {
        transaction.setName(URL, 200)

        expect(transaction.ignore).equal(false)

        done()
      })

      helper.runInTransaction(agent, function (transaction) {
        segment          = agent.tracer.addSegment(NAME)
        transaction.url  = URL
        transaction.verb = 'GET'

        api.setIgnoreTransaction(false)

        transaction.end()
      })
    })
  })

  describe("when explicitly naming controllers", function () {
    describe("in the simplest case", function () {
      var segment
        , transaction


      beforeEach(function (done) {
        agent.on('transactionFinished', function (t) {
          // grab transaction
          transaction = t
          t.setName(URL, 200)
          segment.markAsWeb(URL)
          done()
        })

        helper.runInTransaction(agent, function (transaction) {
          // grab segment
          segment = agent.tracer.addSegment(NAME)

          // HTTP instrumentation sets URL as soon as it knows it
          transaction.url = URL
          transaction.verb = 'POST'

          // NAME THE CONTROLLER
          api.setControllerName('Test')

          transaction.end()
        })
      })

      it("sets the controller in the transaction name", function () {
        expect(transaction.name).equal('WebTransaction/Controller/Test/POST')
      })

      it("names the web trace segment after the controller", function () {
        expect(segment.name).equal('WebTransaction/Controller/Test/POST')
      })

      it("leaves the request URL alone", function () {
        expect(transaction.url).equal(URL)
      })
    })

    it("uses the HTTP verb for the default action", function (done) {
      var segment

      agent.on('transactionFinished', function (transaction) {
        transaction.setName(URL, 200)

        expect(transaction.name).equal('WebTransaction/Controller/Test/DELETE')

        done()
      })

      helper.runInTransaction(agent, function (transaction) {
        segment = agent.tracer.addSegment(NAME)

        transaction.url = URL

        // SET THE ACTION
        transaction.verb = 'DELETE'

        // NAME THE CONTROLLER
        api.setControllerName('Test')

        transaction.end()
      })
    })

    it("allows a custom action", function (done) {
      var segment

      agent.on('transactionFinished', function (transaction) {
        transaction.setName(URL, 200)

        expect(transaction.name).equal('WebTransaction/Controller/Test/index')

        done()
      })

      helper.runInTransaction(agent, function (transaction) {
        segment          = agent.tracer.addSegment(NAME)
        transaction.url  = URL
        transaction.verb = 'GET'

        // NAME THE CONTROLLER AND ACTION
        api.setControllerName('Test', 'index')

        transaction.end()
      })
    })

    it("uses the last controller set when called multiple times", function (done) {
      var segment

      agent.on('transactionFinished', function (transaction) {
        transaction.setName(URL, 200)

        expect(transaction.name).equal('WebTransaction/Controller/Test/list')

        done()
      })

      helper.runInTransaction(agent, function (transaction) {
        segment          = agent.tracer.addSegment(NAME)
        transaction.url  = URL
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

  describe("when adding a custom parameter", function () {
    describe("inside a transaction", function () {
      it("should have set the value properly", function (done) {
        agent.on('transactionFinished', function (transaction) {
          var parameters = transaction.getTrace().custom
          expect(parameters['TestName']).equal('TestValue')

          done()
        })

        helper.runInTransaction(agent, function (transaction) {
          api.addCustomParameter('TestName', 'TestValue')

          transaction.end()
        })
      })

      it("should keep the most-recently seen value", function (done) {
        agent.on('transactionFinished', function (transaction) {
          var parameters = transaction.getTrace().custom
          expect(parameters['TestName']).equal('Third')

          done()
        })

        helper.runInTransaction(agent, function (transaction) {
          api.addCustomParameter('TestName', 'TestValue')
          api.addCustomParameter('TestName', 'Second')
          api.addCustomParameter('TestName', 'Third')

          transaction.end()
        })
      })

      it("should roll with it if custom params are gone", function () {
        helper.runInTransaction(agent, function (transaction) {
          var trace = transaction.getTrace()
          delete trace.custom
          expect(function () {
            api.addCustomParameter('TestName', 'TestValue')
          }).not.throws()
        })
      })

      it("shouldn't allow setting of ignored parameters", function (done) {
        agent.config.ignored_params.push('ignore_me')

        agent.on('transactionFinished', function (transaction) {
          var parameters = transaction.getTrace().custom
          should.not.exist(parameters['ignore_me'])

          done()
        })

        helper.runInTransaction(agent, function (transaction) {
          api.addCustomParameter('ignore_me', 'set')

          transaction.end()
        })
      })

    })

    describe("outside a transaction", function () {
      it("shouldn't blow up", function () {
        expect(function () {
          api.addCustomParameter('TestName', 'TestValue')
        }).not.throws()
      })
    })
  })

  describe("when handed a new naming rule", function () {
    it("should add it to the agent's normalizer", function () {
      expect(agent.userNormalizer.rules.length).equal(0)
      api.addNamingRule('^/simple.*', 'API')
      expect(agent.userNormalizer.rules.length).equal(1)
    })

    describe("in the base case", function () {
      var mine
      beforeEach(function () {
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

      it("should add it to the agent's normalizer", function () {
        expect(agent.urlNormalizer.rules.length).equal(3)
        expect(agent.userNormalizer.rules.length).equal(1)
      })

      it("should leave the passed-in pattern alone", function () {
        expect(mine.pattern.source).equal('^/test/.*')
      })

      it("should have the correct replacement", function () {
        expect(mine.replacement).equal('/Test')
      })

      it("should set it to highest precedence", function () {
        expect(mine.precedence).equal(0)
      })

      it("should end further normalization", function () {
        expect(mine.isTerminal).equal(true)
      })

      it("should only apply it to the whole URL", function () {
        expect(mine.eachSegment).equal(false)
      })
    })

    it("applies a string pattern correctly", function (done) {
      var segment

      api.addNamingRule('^/test/.*', 'Test')

      agent.on('transactionFinished', function (transaction) {
        transaction.setName(URL, 200)

        expect(transaction.name).equal('WebTransaction/NormalizedUri/Test')

        done()
      })

      helper.runInTransaction(agent, function (transaction) {
        segment          = agent.tracer.addSegment(NAME)
        transaction.url  = URL
        transaction.verb = 'GET'

        transaction.end()
      })
    })

    it("applies a regex pattern with capture groups correctly", function (done) {
      var segment

      api.addNamingRule(/^\/test\/(.*)\/(.*)/, 'Test/$2')

      agent.on('transactionFinished', function (transaction) {
        transaction.setName('/test/31337/related', 200)

        expect(transaction.name).equal('WebTransaction/NormalizedUri/Test/related')

        done()
      })

      helper.runInTransaction(agent, function (transaction) {
        segment          = agent.tracer.addSegment(NAME)
        transaction.url  = '/test/31337/related'
        transaction.verb = 'GET'

        transaction.end()
      })
    })
  })

  describe("when handed a new pattern to ignore", function () {
    it("should add it to the agent's normalizer", function () {
      expect(agent.userNormalizer.rules.length).equal(0)
      api.addIgnoringRule('^/simple.*')
      expect(agent.userNormalizer.rules.length).equal(1)
    })

    describe("in the base case", function () {
      var mine
      beforeEach(function () {
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

      it("should add it to the agent's normalizer", function () {
        expect(agent.urlNormalizer.rules.length).equal(3)
        expect(agent.userNormalizer.rules.length).equal(1)
      })

      it("should leave the passed-in pattern alone", function () {
        expect(mine.pattern.source).equal('^/test/.*')
      })

      it("should have the correct replacement", function () {
        expect(mine.replacement).equal('$0')
      })

      it("should set it to highest precedence", function () {
        expect(mine.precedence).equal(0)
      })

      it("should end further normalization", function () {
        expect(mine.isTerminal).equal(true)
      })

      it("should only apply it to the whole URL", function () {
        expect(mine.eachSegment).equal(false)
      })

      it("should ignore transactions related to that URL", function () {
        expect(mine.ignore).equal(true)
      })
    })

    it("applies a string pattern correctly", function (done) {
      var segment

      api.addIgnoringRule('^/test/.*')

      agent.on('transactionFinished', function (transaction) {
        transaction.setName(URL, 200)

        expect(transaction.ignore).equal(true)

        done()
      })

      helper.runInTransaction(agent, function (transaction) {
        segment          = agent.tracer.addSegment(NAME)
        transaction.url  = URL
        transaction.verb = 'GET'

        transaction.end()
      })
    })
  })

  describe("when handed an error to trace", function () {
    it("should add the error even without a transaction", function () {
      expect(agent.errors.errors.length).equal(0)
      api.noticeError(new TypeError('this test is bogus, man'))
      expect(agent.errors.errors.length).equal(1)
    })

    it("should track custom parameters on error without a transaction", function () {
      expect(agent.errors.errors.length).equal(0)
      api.noticeError(new TypeError('this test is bogus, man'), {present : 'yep'})
      expect(agent.errors.errors.length).equal(1)

      var params = agent.errors.errors[0][4]
      expect(params.userAttributes.present).equal('yep')
    })

    it("should add the error associated to a transaction", function (done) {
      expect(agent.errors.errors.length).equal(0)

      agent.on('transactionFinished', function (transaction) {
        expect(agent.errors.errors.length).equal(1)
        var caught = agent.errors.errors[0]
        expect(caught[1]).equal('WebTransaction/Uri/*')
        expect(caught[2]).equal('test error')
        expect(caught[3]).equal('TypeError')

        should.exist(transaction.error)
        expect(transaction.ignore).equal(false)

        done()
      })

      helper.runInTransaction(agent, function (transaction) {
        api.noticeError(new TypeError('test error'))
        transaction.end()
      })
    })

    it("should notice custom parameters associated with an error", function (done) {
      expect(agent.errors.errors.length).equal(0)
      var orig = agent.config.ignored_params
      agent.config.ignored_params = ['ignored']

      agent.on('transactionFinished', function (transaction) {
        expect(agent.errors.errors.length).equal(1)
        var caught = agent.errors.errors[0]
        expect(caught[1]).equal('WebTransaction/Uri/*')
        expect(caught[2]).equal('test error')
        expect(caught[3]).equal('TypeError')
        expect(caught[4].userAttributes.hi).equal('yo')
        should.not.exist(caught[4].ignored)

        should.exist(transaction.error)
        expect(transaction.ignore).equal(false)

        agent.config.ignored_params = orig
        done()
      })

      helper.runInTransaction(agent, function (transaction) {
        api.noticeError(new TypeError('test error'), {hi : 'yo', ignored : 'yup'})
        transaction.end()
      })
    })

    it("should add an error-alike with a message but no stack", function (done) {
      expect(agent.errors.errors.length).equal(0)

      agent.on('transactionFinished', function (transaction) {
        expect(agent.errors.errors.length).equal(1)
        var caught = agent.errors.errors[0]
        expect(caught[1]).equal('WebTransaction/Uri/*')
        expect(caught[2]).equal('not an Error')
        expect(caught[3]).equal('Object')

        should.exist(transaction.error)
        expect(transaction.ignore).equal(false)

        done()
      })

      helper.runInTransaction(agent, function (transaction) {
        api.noticeError({message : 'not an Error'})
        transaction.end()
      })
    })

    it("should add an error-alike with a stack but no message", function (done) {
      expect(agent.errors.errors.length).equal(0)

      agent.on('transactionFinished', function (transaction) {
        expect(agent.errors.errors.length).equal(1)
        var caught = agent.errors.errors[0]
        expect(caught[1]).equal('WebTransaction/Uri/*')
        expect(caught[2]).equal('')
        expect(caught[3]).equal('Error')

        should.exist(transaction.error)
        expect(transaction.ignore).equal(false)

        done()
      })

      helper.runInTransaction(agent, function (transaction) {
        api.noticeError({stack : new Error().stack})
        transaction.end()
      })
    })

    it("shouldn't throw on (or capture) a useless error object", function (done) {
      expect(agent.errors.errors.length).equal(0)

      agent.on('transactionFinished', function (transaction) {
        expect(agent.errors.errors.length).equal(0)
        expect(transaction.ignore).equal(false)

        done()
      })

      helper.runInTransaction(agent, function (transaction) {
        expect(function () { api.noticeError({}); }).not.throws()
        transaction.end()
      })
    })

    it("should add a string error associated to a transaction", function (done) {
      expect(agent.errors.errors.length).equal(0)

      agent.on('transactionFinished', function (transaction) {
        expect(agent.errors.errors.length).equal(1)
        var caught = agent.errors.errors[0]
        expect(caught[1]).equal('WebTransaction/Uri/*')
        expect(caught[2]).equal('busted, bro')
        expect(caught[3]).equal('Error')

        should.exist(transaction.error)
        expect(transaction.ignore).equal(false)

        done()
      })

      helper.runInTransaction(agent, function (transaction) {
        api.noticeError('busted, bro')
        transaction.end()
      })
    })

    it("should allow custom parameters to be added to string errors", function (done) {
      expect(agent.errors.errors.length).equal(0)

      agent.on('transactionFinished', function (transaction) {
        expect(agent.errors.errors.length).equal(1)
        var caught = agent.errors.errors[0]
        expect(caught[2]).equal('busted, bro')
        expect(caught[4].userAttributes.a).equal(1)
        expect(caught[4].userAttributes.steak).equal('sauce')

        should.exist(transaction.error)
        expect(transaction.ignore).equal(false)

        done()
      })

      helper.runInTransaction(agent, function (transaction) {
        api.noticeError('busted, bro', {a : 1, steak : 'sauce'})
        transaction.end()
      })
    })
  })

  describe('when recording custom metrics', function () {
    it('it should aggregate metric values', function () {
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

    it('it should merge metrics', function () {
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

    it('it should increment properly', function () {
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

    it('should not blow up when disabled', function () {
      agent.config.feature_flag.custom_metrics = false
      api.incrementMetric('/Custom/metric/thing')
      api.recordMetric('/Custom/metric/thing', 3)
    })
  })
})
