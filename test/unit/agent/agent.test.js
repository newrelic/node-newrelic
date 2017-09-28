'use strict'

var sinon = require('sinon')
var chai = require('chai')
var should = chai.should()
var expect = chai.expect
var nock = require('nock')
var helper = require('../../lib/agent_helper.js')
var sampler = require('../../../lib/sampler.js')
var semver = require('semver')
var configurator = require('../../../lib/config.js')
var Agent = require('../../../lib/agent.js')
var Transaction = require('../../../lib/transaction')
var clearAWSCache = require('../../../lib/utilization/aws-info').clearCache


/*
 *
 * CONSTANTS
 *
 */
var RUN_ID = 1337
var URL = 'https://collector.newrelic.com'

// TODO: do we need to mock AWS (and other vendors) in these tests?
// Why not just disable?
var awsHost = "http://169.254.169.254"

var awsResponses = {
  "dynamic/instance-identity/document": {
    "instanceType": "test.type",
    "instanceId": "test.id",
    "availabilityZone": "us-west-2b"
  }
}

var awsRedirect

function refreshAWSEndpoints() {
    clearAWSCache()
    awsRedirect = nock(awsHost)
    for (var awsPath in awsResponses) {
      var redirect = awsRedirect.get('/2016-09-02/' + awsPath)
      redirect.reply(200, awsResponses[awsPath])
    }
}


describe("the New Relic agent", function() {
  before(function() {
    nock.disableNetConnect()
    refreshAWSEndpoints()
  })

  after(function() {
    nock.enableNetConnect()
  })

  it("requires the configuration be passed to the constructor", function() {
    expect(function() { new Agent() }).to.throw() // eslint-disable-line no-new
  })

  it("doesn't throw when passed a valid configuration", function () {
    var config = configurator.initialize({agent_enabled : false})
    var agent = new Agent(config)

    expect(agent.config.agent_enabled).equal(false)
  })

  describe("when configured", function () {
    var agent

    beforeEach(function () {
      agent = helper.loadMockedAgent()
    })

    afterEach(function () {
      helper.unloadAgent(agent)
    })

    it("bootstraps its configuration", function () {
      should.exist(agent.config)
    })

    it("has an error tracer", function () {
      should.exist(agent.errors)
    })

    it("has query tracer", function () {
      should.exist(agent.queries)
    })

    it("uses an aggregator to apply top N slow trace logic", function () {
      should.exist(agent.traces)
    })

    it("has a URL normalizer", function () {
      should.exist(agent.urlNormalizer)
    })

    it("has a metric name normalizer", function () {
      should.exist(agent.metricNameNormalizer)
    })

    it("has a transaction name normalizer", function () {
      should.exist(agent.transactionNameNormalizer)
    })

    it("has a consolidated metrics collection that transactions feed into", function () {
      should.exist(agent.metrics)
    })

    it("has a function to look up the active transaction", function () {
      expect(function () { agent.getTransaction(); }).not.throws()
    })

    it("requires new configuration to reconfigure the agent", function () {
      expect(function () { agent.reconfigure(); }).throws()
    })

    it("defaults to a state of 'stopped'", function () {
      expect(agent._state).equal('stopped')
    })

    it("requires a valid value when changing state", function () {
      expect(function () { agent.setState('bogus'); }).throws('Invalid state bogus')
    })

    it("has some debugging configuration by default", function () {
      should.exist(agent.config.debug)
    })

    describe("with debugging configured", function () {
      it("internal instrumentation is disabled by default", function () {
        var debug = agent.config.debug
        expect(debug.internal_metrics).equal(false)
      })

      it("internal instrumentation can be configured", function () {
        var config = configurator.initialize({debug : {internal_metrics : true}})
        var debugged = new Agent(config)

        var debug = debugged.config.debug
        expect(debug.internal_metrics).equal(true)
      })

      describe("with internal instrumentation enabled", function () {
        var debugged

        beforeEach(function () {
          var config = configurator.initialize({
            license_key : 'license key here',
            run_id      : RUN_ID,
            debug       : {internal_metrics   : true}
          })
          debugged = new Agent(config)
        })

        it("should have an object for tracking internal metrics", function () {
          should.exist(debugged.config.debug.supportability)
        })

        it("should set apdexT on the supportability metrics on connect", function (done) {

          var config = configurator.initialize({
            license_key : 'license key here',
            debug       : {internal_metrics   : true}
          })
          debugged = new Agent(config)

          expect(debugged.config.debug.supportability.apdexT).equal(0.1)

          var redirect =
            nock(URL)
              .post(helper.generateCollectorPath('get_redirect_host'))
              .reply(200, {return_value : 'collector.newrelic.com'})
          var connect =
            nock(URL)
              .post(helper.generateCollectorPath('connect'))
              .reply(200, {return_value : {agent_run_id : RUN_ID, apdex_t : 0.5}})
          var settings =
            nock(URL)
              .post(helper.generateCollectorPath('agent_settings', RUN_ID))
              .reply(200, {return_value: []})
          var metrics =
            nock(URL)
              .post(helper.generateCollectorPath('metric_data', RUN_ID))
              .reply(200, {return_value: []})
          var shutdown =
            nock(URL)
              .post(helper.generateCollectorPath('shutdown', RUN_ID))
              .reply(200, {return_value : null})

          debugged.start(function cb_start() {
            expect(debugged.config.debug.supportability.apdexT).equal(0.5)

            redirect.done()
            connect.done()
            debugged.stop(function cb_stop() {
              settings.done()
              awsRedirect.done()
              metrics.done()
              shutdown.done()
              done()
            })
          })
        })

        it("should find an internal metric for transaction processed", function (done) {
          debugged.once('transactionFinished', function () {
            var supportability = debugged.config.debug.supportability
            var metric = supportability.getMetric('Supportability/Transaction/Count')


            should.exist(metric)
            expect(metric.callCount).equal(1)

            done()
          })

          var transaction = new Transaction(debugged)
          transaction.end()
        })

        it("should merge supportability metrics into sent payload", function (done) {
          debugged.collector.metricData = function (payload, callback) {
            var metrics = payload[3]
            expect(metrics.getMetric('Supportability/Transaction/Count').callCount)
              .equal(1)

            callback()
          }

          var transaction = new Transaction(debugged)
          transaction.end(function cb_transactionEnd() {
            debugged._sendMetrics(function cb__sendMetrics() {
              done()
            })
          })
        })
      })
    })

    describe("with naming rules configured", function() {
      var configured
      beforeEach(function() {
        var config = configurator.initialize({
          rules : {name : [
            {pattern: '^/t',  name: 'u'},
            {pattern: /^\/u/, name: 't'}
          ]}
        })
        configured = new Agent(config)
      })

      it("loads the rules", function() {
        var rules = configured.userNormalizer.rules
        expect(rules.length).equal(2 + 1) // +1 default ignore rule

        // Rules are reversed by default
        expect(rules[2].pattern.source).equal('^\\/u')

        if (semver.satisfies(process.versions.node, '>=1.0.0')) {
            expect(rules[1].pattern.source).equal('^\\/t')
        } else {
            expect(rules[1].pattern.source).equal('^/t')
        }
      })
    })

    describe("with ignoring rules configured", function() {
      var configured

      beforeEach(function() {
        var config = configurator.initialize({
          rules : {ignore : [
            /^\/ham_snadwich\/ignore/
          ]}
        })
        configured = new Agent(config)
      })

      it("loads the rules", function() {
        var rules = configured.userNormalizer.rules
        expect(rules.length).equal(1)
        expect(rules[0].pattern.source).equal('^\\/ham_snadwich\\/ignore')
        expect(rules[0].ignore).equal(true)
      })
    })

    describe("when forcing transaction ignore status", function() {
      var agent

      beforeEach(function () {
        var config = configurator.initialize({
          rules : {ignore : [
            /^\/ham_snadwich\/ignore/
          ]}
        })
        agent = new Agent(config)
      })

      it("shouldn't error when forcing an ignore", function () {
        var transaction = new Transaction(agent)
        transaction.forceIgnore = true
        transaction.finalizeNameFromUri('/ham_snadwich/attend', 200)
        expect(transaction.ignore).equal(true)

        expect(function () { transaction.end(); }).not.throws()
      })

      it("shouldn't error when forcing a non-ignore", function () {
        var transaction = new Transaction(agent)
        transaction.forceIgnore = false
        transaction.finalizeNameFromUri('/ham_snadwich/ignore', 200)
        expect(transaction.ignore).equal(false)

        expect(function () { transaction.end(); }).not.throws()
      })

      it("should ignore when finalizeNameFromUri is not called", function() {
        var transaction = new Transaction(agent)
        transaction.forceIgnore = true
        agent._transactionFinished(transaction)
        expect(transaction.ignore).equal(true)
      })
    })

    describe("when starting", function () {
      it("should require a callback", function () {
        expect(function () { agent.start(); }).throws("callback required!")
      })

      it("should change state to 'starting'", function (done) {
        agent.collector.connect = function () { done(); }
        agent.start(function cb_start() {})
        expect(agent._state).equal('starting')
      })

      it("shouldn't error when disabled via configuration", function (done) {
        agent.config.agent_enabled = false
        agent.collector.connect = function () {
          done(new Error("shouldn't be called"))
        }
        agent.start(done)
      })

      it("should emit 'stopped' when disabled via configuration", function (done) {
        agent.config.agent_enabled = false
        agent.collector.connect = function () {
          done(new Error("shouldn't be called"))
        }
        agent.start(function cb_start() {
          expect(agent._state).equal('stopped')
          done()
        })
      })

      it("should error when no license key is included", function (done) {
        agent.config.license_key = undefined
        agent.collector.connect = function () {
          done(new Error("shouldn't be called"))
        }
        agent.start(function cb_start(error) {
          should.exist(error)

          done()
        })
      })

      it("should say why startup failed without license key", function (done) {
        agent.config.license_key = undefined
        agent.collector.connect = function () {
          done(new Error("shouldn't be called"))
        }
        agent.start(function cb_start(error) {
          expect(error.message).equal("Not starting without license key!")

          done()
        })
      })

      it("should call connect when using proxy", function (done) {
        agent.config.proxy = 'fake://url'

        agent.collector.connect = function (callback) {
          should.exist(callback)
          callback()
        }

        agent.start(done)
      })

      it("should call connect when config is correct", function (done) {
        agent.collector.connect = function (callback) {
          should.exist(callback)
          callback()
        }

        agent.start(done)
      })

      it("should error when connection fails", function (done) {
        var passed = new Error("passin' on through")

        agent.collector.connect = function (callback) {
          callback(passed)
        }

        agent.start(function cb_start(error) {
          expect(error).equal(passed)

          done()
        })
      })

      it("should harvest at connect when metrics are already there", function (done) {
        var metrics =
          nock(URL)
            .post(helper.generateCollectorPath('metric_data', RUN_ID))
            .reply(200, {return_value: []})

        agent.collector.connect = function (callback) {
          callback(null, {agent_run_id : RUN_ID})
        }

        agent.config.run_id = RUN_ID

        agent.metrics.measureMilliseconds('Test/Bogus', null, 1)

        agent.start(function cb_start(error) {
          should.not.exist(error)

          metrics.done()
          done()
        })
      })

      it("shouldn't blow up when harvest cycle runs", function (done) {
        var origInterval = global.setInterval
        global.setInterval = function (callback) { return setTimeout(callback, 0); }

        // manually harvesting
        agent.config.no_immediate_harvest = true

        var redirect =
          nock(URL)
            .post(helper.generateCollectorPath('get_redirect_host'))
            .reply(200, {return_value : 'collector.newrelic.com'})
        var connect =
          nock(URL)
            .post(helper.generateCollectorPath('connect'))
            .reply(200, {return_value : {agent_run_id : RUN_ID}})
        var settings =
          nock(URL)
            .post(helper.generateCollectorPath('agent_settings', RUN_ID))
            .reply(200, {return_value: []})

        agent.start(function cb_start() {
          setTimeout(function () {
            global.setInterval = origInterval

            redirect.done()
            awsRedirect.done()
            connect.done()
            settings.done()
            done()
          }, 15)
        })
      })

      it("shouldn't blow up when harvest cycle errors", function (done) {
        var origInterval = global.setInterval
        global.setInterval = function (callback) { return setTimeout(callback, 0); }

        var redirect =
          nock(URL)
            .post(helper.generateCollectorPath('get_redirect_host'))
            .reply(200, {return_value : 'collector.newrelic.com'})
        var connect =
          nock(URL)
            .post(helper.generateCollectorPath('connect'))
            .reply(200, {return_value : {agent_run_id : RUN_ID}})
        var settings =
          nock(URL)
            .post(helper.generateCollectorPath('agent_settings', RUN_ID))
            .reply(200, {return_value: []})
        var metrics =
          nock(URL)
            .post(helper.generateCollectorPath('metric_data', RUN_ID))
            .times(2)
            .reply(503)

        agent.start(function cb_start() {
          setTimeout(function () {
            global.setInterval = origInterval

            redirect.done()
            connect.done()
            awsRedirect.done()
            settings.done()
            metrics.done()
            done()
          }, 15)
        })
      })
    })

    describe("when stopping", function () {
      function nop() {}

      it("should require a callback", function () {
        expect(function () { agent.stop(); }).throws("callback required!")
      })

      it("shouldn't error if no harvester handle is set", function () {
        agent.harvesterHandle = undefined
        agent.collector.shutdown = nop

        expect(function () { agent.stop(nop); }).not.throws()
      })

      it("shouldn't error if a harvester handle is set", function () {
        agent.harvesterHandle = setInterval(function () { throw new Error("nope"); }, 5)
        agent.collector.shutdown = nop

        expect(function () { agent.stop(nop); }).not.throws()
      })

      it("should clear harvester handle is set", function () {
        agent.harvesterHandle = setInterval(function () { throw new Error("nope"); }, 5)
        agent.collector.shutdown = nop

        agent.stop(nop)
        should.not.exist(agent.harvesterHandle)
      })

      it("should stop sampler", function () {
        sampler.start(agent)
        agent.collector.shutdown = nop
        agent.stop(nop)

        expect(sampler.state).equal('stopped')
      })

      it("should change state to 'stopping'", function () {
        sampler.start(agent)
        agent.collector.shutdown = nop
        agent.stop(nop)

        expect(agent._state).equal('stopping')
      })


      it("shouldn't shut down connection if not connected", function (done) {
        agent.stop(function cb_stop(error) {
          should.not.exist(error)
          done()
        })
      })

      describe("if connected", function () {
        it("should call shutdown", function (done) {
          agent.config.run_id = RUN_ID
          var shutdown =
            nock(URL)
              .post(helper.generateCollectorPath('shutdown', RUN_ID))
              .reply(200, {return_value : null})

          agent.stop(function cb_stop(error) {
            should.not.exist(error)

            shutdown.done()
            done()
          })
        })

        it("should pass through error if shutdown fails", function (done) {
          agent.config.run_id = RUN_ID
          var shutdown =
            nock(URL)
              .post(helper.generateCollectorPath('shutdown', RUN_ID))
              .reply(503)

          agent.stop(function cb_stop(error) {
            should.exist(error)
            expect(error.message).equal("No body found in response to shutdown.")

            shutdown.done()
            done()
          })
        })
      })
    })

    describe("when calling out to the collector", function () {
      it("should update the metrics' apdex tolerating value when configuration changes",
         function (done) {
        expect(agent.metrics.apdexT).equal(0.1)
        process.nextTick(function cb_nextTick() {
          should.exist(agent.metrics.apdexT)
          expect(agent.metrics.apdexT).equal(0.666)

          done()
        })

        agent.config.emit('apdex_t', 0.666)
      })

      it("should reset the configuration and metrics normalizer on connection",
         function (done) {
        var config = {
          agent_run_id       : 404,
          apdex_t            : 0.742,
          data_report_period : 69,
          url_rules          : []
        }

        var redirect = nock(URL)
                         .post(helper.generateCollectorPath('get_redirect_host'))
                         .reply(200, {return_value : 'collector.newrelic.com'})
        var handshake = nock(URL)
                          .post(helper.generateCollectorPath('connect'))
                          .reply(200, {return_value : config})
        var settings = nock(URL)
                          .post(helper.generateCollectorPath('agent_settings', 404))
                          .reply(200, {return_value : config})
        var metrics = nock(URL)
                          .post(helper.generateCollectorPath('metric_data', 404))
                          .reply(200, {return_value: []})
        var shutdown = nock(URL)
                          .post(helper.generateCollectorPath('shutdown', 404))
                          .reply(200, {return_value : null})

        agent.start(function cb_start(error) {
          should.not.exist(error)
          redirect.done()
          handshake.done()

          expect(agent._state).equal('started')
          expect(agent.config.run_id).equal(404)
          expect(agent.config.data_report_period).equal(69)
          expect(agent.metrics.apdexT).equal(0.742)
          expect(agent.urlNormalizer.rules).deep.equal([])

          agent.stop(function cb_stop() {
            settings.done()
            metrics.done()
            awsRedirect.done()
            shutdown.done()
            done()
          })
        })
      })

      it("should capture the trace off a finished transaction", function (done) {
        var trans = new Transaction(agent)
        // need to initialize the trace
        trans.trace.setDurationInMillis(2100)

        agent.once('transactionFinished', function () {
          var trace = agent.traces.trace
          should.exist(trace)
          expect(trace.getDurationInMillis(), "same trace just passed in").equal(2100)

          return done()
        })

        trans.end()
      })

      it("should capture the synthetic trace off a finished transaction", function (done) {
        var trans = new Transaction(agent)
        // need to initialize the trace
        trans.trace.setDurationInMillis(2100)
        trans.syntheticsData = {
          version: 1,
          accountId: 357,
          resourceId: 'resId',
          jobId: 'jobId',
          monitorId: 'monId'
        }

        agent.once('transactionFinished', function () {
          expect(agent.traces.trace).not.exist()
          expect(agent.traces.syntheticsTraces).length(1)
          var trace = agent.traces.syntheticsTraces[0]
          expect(trace.getDurationInMillis(), "same trace just passed in").equal(2100)

          return done()
        })

        trans.end()
      })
    })

    describe("when apdex_t changes", function () {
      var APDEX_T = 0.9876

      it("should update the current metrics collection's apdexT", function () {
        expect(agent.metrics.apdexT).not.equal(APDEX_T)

        agent._apdexTChange(APDEX_T)

        expect(agent.metrics.apdexT).equal(APDEX_T)
      })
    })

    describe("when parsing metric mappings", function () {
      var NAME     = 'Custom/Test/events'
      var SCOPE    = 'TEST'
      var METRICID = 17


      beforeEach(function () {
        agent.config.run_id = RUN_ID
      })

      it("shouldn't throw if no new rules are received", function (done) {
        var metrics =
          nock(URL)
            .post(helper.generateCollectorPath('metric_data', RUN_ID))
            .reply(200, {return_value : null})

        // need metrics or agent won't make a call against the collector
        agent.metrics.measureMilliseconds('Test/bogus', null, 1)

        agent.harvest(function cb_harvest(error) {
          should.not.exist(error)

          metrics.done()
          done()
        })
      })

      it("shouldn't throw if new rules are received", function (done) {
        var rules = [[{name : 'Test/RenameMe1'}, 1001],
                     [{name : 'Test/RenameMe2', scope : 'TEST'}, 1002]]

        var metrics =
          nock(URL)
            .post(helper.generateCollectorPath('metric_data', RUN_ID))
            .reply(200, {return_value : rules})

        // need metrics or agent won't make a call against the collector
        agent.metrics.measureMilliseconds('Test/bogus', null, 1)

        agent.harvest(function cb_harvest(error) {
          should.not.exist(error)

          metrics.done()
          done()
        })
      })

      it("should add them to the existing mappings", function (done) {
        var rules = [[{name : NAME, scope : SCOPE}, METRICID]]

        var metrics =
          nock(URL)
            .post(helper.generateCollectorPath('metric_data', RUN_ID))
            .reply(200, {return_value : rules})

        // need metrics or agent won't make a call against the collector
        agent.metrics.measureMilliseconds('Test/bogus', null, 1)

        agent.config.run_id = RUN_ID
        agent.harvest(function cb_harvest(error) {
          should.not.exist(error)
          expect(agent.mapper.map(NAME, SCOPE)).equal(17)

          metrics.done()
          done()
        })
      })
    })

    describe("when handling finished transactions", function () {
      var transaction

      beforeEach(function () {
        transaction = new Transaction(agent)
        transaction.ignore = true
      })

      it("shouldn't merge metrics when transaction is ignored", function () {
        /* Top-level method is bound into EE, so mock the metrics collection
         * instead.
         */
        var mock = sinon.mock(agent.metrics)
        mock.expects('merge').never()

        transaction.end()
      })

      it("shouldn't merge errors when transaction is ignored", function () {
        /* Top-level method is bound into EE, so mock the error tracer instead.
         */
        var mock = sinon.mock(agent.errors)
        mock.expects('onTransactionFinished').never()

        transaction.end()
      })

      it("shouldn't aggregate trace when transaction is ignored", function () {
        /* Top-level *and* second-level methods are bound into EEs, so mock the
         * transaction trace record method instead.
         */
        var mock = sinon.mock(transaction)
        mock.expects('record').never()

        transaction.end()
      })
    })

    describe("when tweaking the harvest cycle", function () {
      afterEach(function () {
        agent._stopHarvester()
      })

      it("should begin with no harvester active", function () {
        should.not.exist(agent.harvesterHandle)
      })

      it("should start a harvester without throwing", function () {
        expect(function () { agent._startHarvester(10); }).not.throws()
        should.exist(agent.harvesterHandle)
      })

      it("should stop an unstarted harvester without throwing", function () {
        expect(function () { agent._startHarvester(10); }).not.throws()
      })

      it("should stop a started harvester", function () {
        agent._startHarvester(10)
        agent._stopHarvester()
        should.not.exist(agent.harvesterHandle)
      })

      it("should restart an unstarted harvester without throwing", function () {
        expect(function () { agent._restartHarvester(10); }).not.throws()
        should.exist(agent.harvesterHandle)
      })

      it("should restart a started harvester", function () {
        agent._startHarvester(10)
        var before = agent.harvesterHandle
        should.exist(before)
        agent._restartHarvester(10)
        expect(agent.harvesterHandle).not.equal(before)
      })

      it("shouldn't alter interval when harvester's not running", function (done) {
        should.not.exist(agent.harvesterHandle)
        agent._harvesterIntervalChange(13, function () {
          should.not.exist(agent.harvesterHandle)

          done()
        })
      })

      it("shouldn't crash when no callback is passed on interval change", function () {
        agent.harvesterHandle = setInterval(function () {}, 2 << 40)
        expect(function () { agent._harvesterIntervalChange(69); }).not.throws()
      })

      it("should alter interval when harvester's not running", function (done) {
        agent._startHarvester(10)
        var before = agent.harvesterHandle
        should.exist(before)

        agent._harvesterIntervalChange(13, function (error) {
          expect(error.message).equal("Not connected to New Relic!")
          expect(agent.harvesterHandle).not.equal(before)

          done()
        })
      })
    })
  })

  describe("when harvesting", function () {
    var agent

    beforeEach(function () {
      var config = configurator.initialize({
        run_id      : RUN_ID,
        license_key : 'license key here'
      })
      agent = new Agent(config)

      // turn off error events, so that does not interfere with this test
      agent.config.error_collector.capture_events = false
    })

    it("harvest requires a callback", function () {
      expect(function () { agent.harvest(); }).throws("callback required!")
    })

    it("the last reported time is congruent with reality", function () {
      expect(agent.metrics.started).closeTo(Date.now(), 1000)
    })

    it("sends transactions to the new error handler after harvest", function (done) {
      agent.metrics.started = 1337

      var metricData =
        nock(URL)
          .post(helper.generateCollectorPath('metric_data', RUN_ID))
          .reply(200, {return_value: []})

      // need metrics or agent won't make a call against the collector
      agent.metrics.measureMilliseconds('Test/bogus', null, 1)

      agent.harvest(function cb_harvest() {
        metricData.done()

        agent.errors = {
          onTransactionFinished : function (t) {
            expect(t).equal(transaction)
            done()
          }
        }

        var transaction = new Transaction(agent)
        transaction.statusCode = 200
        transaction.end()
      })
    })

    it("reports the error count", function (done) {
      agent.errors.add(null, new TypeError('no method last on undefined'))
      agent.errors.add(null, new Error('application code error'))
      agent.errors.add(null, new RangeError('stack depth exceeded'))

      agent.collector.metricData = function (payload) {
        var metrics = payload[3]
        var metric  = metrics.getMetric('Errors/all')


        should.exist(metric)
        expect(metric.callCount).equal(3)

        done()
      }

      agent.harvest(function nop() {})
    })

    it("reports web transactions error count", function (done) {
      var transaction = new Transaction(agent)
      transaction.url = '/some/path'
      expect(transaction.isWeb()).to.be.true

      agent.errors.add(transaction, new TypeError('no method last on undefined'))
      agent.errors.add(transaction, new Error('application code error'))
      agent.errors.add(transaction, new RangeError('stack depth exceeded'))

      agent.collector.metricData = function (payload) {
        var metrics = payload[3]
        var metric  = metrics.getMetric('Errors/allWeb')

        should.exist(metric)
        expect(metric.callCount).equal(3)

        done()
      }

      transaction.end(harvest)

      function harvest() {
        agent.harvest(function nop() {})
      }
    })

    it("reports background transactions error count", function(done) {
      var transaction = new Transaction(agent)
      transaction.type = Transaction.TYPES.BG
      expect(transaction.isWeb()).to.be.false()

      agent.errors.add(transaction, new TypeError('no method last on undefined'))
      agent.errors.add(transaction, new Error('application code error'))
      agent.errors.add(transaction, new RangeError('stack depth exceeded'))

      agent.collector.metricData = function(payload) {
        var metrics = payload[3]
        var metric  = metrics.getMetric('Errors/allOther')

        expect(metric).to.exist().and.have.property('callCount', 3)

        done()
      }

      transaction.end(harvest)

      function harvest() {
        agent.harvest(function nop() {})
      }
    })

    it("resets error count after harvest", function (done) {
      // turn off error events, so that does not interfere with this test
      agent.config.error_collector.capture_events = false

      agent.errors.add(null, new TypeError('no method last on undefined'))
      agent.errors.add(null, new Error('application code error'))
      agent.errors.add(null, new RangeError('stack depth exceeded'))

      agent.collector.metricData = function (payload, cb) {
        // These tests do not clean up after themselves, at least call the cb
        // that harvest doesn't hang.
        cb()
      }

      var old_ed = agent.collector.errorData
      agent.collector.errorData = function (errors, cb) {
        cb()
      }

      agent.harvest(function cb_harvest() {
        expect(agent.errors.errorCount).equal(0)
        agent.collector.errorData = old_ed
        done()
      })

    })

    it("resets error count after harvest when error collector is off", function (done) {
      // turn off error events, so that does not interfere with this test
      agent.config.error_collector.capture_events = false

      agent.errors.add(null, new TypeError('no method last on undefined'))
      agent.errors.add(null, new Error('application code error'))
      agent.errors.add(null, new RangeError('stack depth exceeded'))

      // Defaults to true, but maybe it'll change in the future.
      var old_config = agent.config.error_collector.enabled
      agent.config.error_collector.enabled = false

      agent.collector.metricData = function (payload, cb) {
        // These tests do not clean up after themselves, at least call the cb
        // that harvest doesn't hang.
        cb()
      }

      agent.harvest(function cb_harvest() {
        expect(agent.errors.errorCount).equal(0)
        agent.config.error_collector.enabled = old_config
        done()
      })
    })

    it("bails out early when sending metrics fails", function (done) {
      var metricData =
        nock(URL)
          .post(helper.generateCollectorPath('metric_data', RUN_ID))
          .reply(503)

      agent.errors.add(null, new Error('application code error'))

      agent.harvest(function cb_harvest(error) {
        should.exist(error)
        expect(error.message).equal("No body found in response to metric_data.")

        metricData.done()
        done()
      })
    })

    it("bails out early when sending errors fails", function (done) {
      var metricData =
        nock(URL)
          .post(helper.generateCollectorPath('metric_data', RUN_ID))
          .reply(200, {return_value : null})
      var errorData =
        nock(URL)
          .post(helper.generateCollectorPath('error_data', RUN_ID))
          .reply(503)

      agent.errors.add(null, new Error('application code error'))

      agent.harvest(function cb_harvest(error) {
        should.exist(error)
        expect(error.message).equal("No body found in response to error_data.")

        metricData.done()
        errorData.done()
        done()
      })
    })

    it("doesn't send errors when error tracer disabled", function (done) {
      var settings =
        nock(URL)
          .post(helper.generateCollectorPath('agent_settings', RUN_ID))
          .reply(200, {return_value: []})
      var metricData =
        nock(URL)
          .post(helper.generateCollectorPath('metric_data', RUN_ID))
          .reply(200, {return_value: []})

      agent.errors.add(null, new TypeError('no method last on undefined'))
      agent.errors.add(null, new Error('application code error'))
      agent.errors.add(null, new RangeError('stack depth exceeded'))

      // do this here so error traces get collected but not sent
      agent.config.onConnect({'error_collector.enabled' : false})

      agent.harvest(function cb_harvest(error) {
        should.not.exist(error)

        metricData.done()

        // Wait for agent_settings command to be sent after event emitted from onConnect
        setTimeout(function() {
          settings.done()
          done()
        }, 15)
      })
    })

    it("doesn't send errors when server disables collect_errors", function (done) {
      // turn off error events, so that does not interfere with this test
      agent.config.error_collector.capture_events = false

      var settings =
        nock(URL)
          .post(helper.generateCollectorPath('agent_settings', RUN_ID))
          .reply(200, {return_value: []})
      var metricData =
        nock(URL)
          .post(helper.generateCollectorPath('metric_data', RUN_ID))
          .reply(200, {return_value: []})

      agent.errors.add(null, new TypeError('no method last on undefined'))
      agent.errors.add(null, new Error('application code error'))
      agent.errors.add(null, new RangeError('stack depth exceeded'))

      // do this here so error traces get collected but not sent
      agent.config.onConnect({collect_errors : false})

      agent.harvest(function cb_harvest(error) {
        should.not.exist(error)

        metricData.done()

        // Wait for agent_settings command to be sent after event emitted from onConnect
        setTimeout(function() {
          settings.done()
          done()
        }, 15)
      })
    })

    it("doesn't send queries when slow_sql is disabled", function (done) {
      var settings =
        nock(URL)
          .post(helper.generateCollectorPath('agent_settings', RUN_ID))
          .reply(200, {return_value: []})

      var metricData =
        nock(URL)
          .post(helper.generateCollectorPath('metric_data', RUN_ID))
          .reply(200, {return_value: []})

      agent.config.slow_sql.enabled = true
      agent.config.transaction_tracer.record_sql = 'raw'

      agent.queries.addQuery(
        new FakeSegment('test', 700),
        'mysql',
        'select * from foo',
        new Error()
      )

      expect(Object.keys(agent.queries.samples).length).equal(1)
      agent.config.onConnect({collect_errors : false})
      // do this here so error traces get collected but not sent
      agent.config.slow_sql.enabled = false


      agent.harvest(function cb_harvest(error) {
        should.not.exist(error)

        metricData.done()

        // Wait for agent_settings command to be sent after event emitted from onConnect
        setTimeout(function() {
          settings.done()
          done()
        }, 15)
      })

      function FakeSegment(name, duration) {
        this.name = name
        this.parameters = {}
        this.getDurationInMillis = function getDurationInMillis() {
          return duration
        }
      }
    })

    it("sends query trace when there's a trace to send", function (done) {
      var transaction = new Transaction(agent)
      transaction.finalizeNameFromUri('/test/path/31337', 501)
      transaction.trace.setDurationInMillis(4001)
      transaction.end()

      agent.config.slow_sql.enabled = true
      agent.config.transaction_tracer.record_sql = 'raw'

      agent.queries.addQuery(
        transaction.trace.root,
        'mysql',
        'select * from foo',
        new Error()
      )

      var metricData =
        nock(URL)
          .post(helper.generateCollectorPath('metric_data', RUN_ID))
          .reply(200, {return_value: []})
      var eventData =
        nock(URL)
          .post(helper.generateCollectorPath('analytic_event_data', RUN_ID))
          .reply(200, {return_value: []})
      var transactionSampleData =
        nock(URL)
          .post(helper.generateCollectorPath('transaction_sample_data', RUN_ID))
          .reply(200, {return_value : null})
      var errorData =
        nock(URL)
          .post(helper.generateCollectorPath('error_data', RUN_ID))
          .reply(200, {return_value : null})
      var queryData =
        nock(URL)
          .post(helper.generateCollectorPath('sql_trace_data', RUN_ID))
          .reply(200, {return_value : null})

      agent.harvest(function cb_harvest(error) {
        should.not.exist(error)

        metricData.done()
        eventData.done()
        queryData.done()
        transactionSampleData.done()
        done()
      })
    })

    it("merges queries when send fails", function (done) {
      var transaction = new Transaction(agent)
      transaction.finalizeNameFromUri('/test/path/31337', 501)
      transaction.trace.setDurationInMillis(4001)
      transaction.end()

      agent.config.slow_sql.enabled = true
      agent.config.transaction_tracer.record_sql = 'raw'

      agent.queries.addQuery(
        transaction.trace.root,
        'mysql',
        'select * from foo',
        new Error()
      )

      var metricData =
        nock(URL)
          .post(helper.generateCollectorPath('metric_data', RUN_ID))
          .reply(200, {return_value: []})
      var eventData =
        nock(URL)
          .post(helper.generateCollectorPath('analytic_event_data', RUN_ID))
          .reply(200, {return_value: []})
      var transactionSampleData =
        nock(URL)
          .post(helper.generateCollectorPath('transaction_sample_data', RUN_ID))
          .reply(200, {return_value : null})
      var errorData =
        nock(URL)
          .post(helper.generateCollectorPath('error_data', RUN_ID))
          .reply(200, {return_value : null})
      var queryData =
        nock(URL)
          .post(helper.generateCollectorPath('sql_trace_data', RUN_ID))
          .reply(500, {return_value : null})


      var sendQueries = agent._sendQueries

      agent._sendQueries = function mockSendQueries() {
        expect(Object.keys(agent.queries.samples).length).equal(1)
        sendQueries.apply(this, arguments)
        expect(Object.keys(agent.queries.samples).length).equal(0)
      }

      agent.harvest(function cb_harvest(error) {
        expect(Object.keys(agent.queries.samples).length).equal(1)
        expect(error.statusCode).equal(500)

        metricData.done()
        eventData.done()
        queryData.done()
        transactionSampleData.done()
        done()
      })


    })

    it("doesn't send transaction traces when slow traces disabled", function (done) {
      var transaction = new Transaction(agent)
      transaction.finalizeNameFromUri('/test/path/31337', 501)
      agent.errors.add(transaction, new TypeError('no method last on undefined'))
      agent.errors.add(transaction, new Error('application code error'))
      agent.errors.add(transaction, new RangeError('stack depth exceeded'))
      transaction.end()

      var settings =
        nock(URL)
          .post(helper.generateCollectorPath('agent_settings', RUN_ID))
          .reply(200, {return_value: []})
      var metricData =
        nock(URL)
          .post(helper.generateCollectorPath('metric_data', RUN_ID))
          .reply(200, {return_value: []})
      var eventData =
        nock(URL)
          .post(helper.generateCollectorPath('analytic_event_data', RUN_ID))
          .reply(200, {return_value: []})
      var errorData =
        nock(URL)
          .post(helper.generateCollectorPath('error_data', RUN_ID))
          .reply(200, {return_value : null})

      // do this here so slow trace gets collected but not sent
      agent.config.onConnect({'transaction_tracer.enabled' : false})

      agent.harvest(function cb_harvest(error) {
        should.not.exist(error)

        metricData.done()
        eventData.done()
        errorData.done()

        // Wait for agent_settings command to be sent after event emitted from onConnect
        setTimeout(function() {
          settings.done()
          done()
        }, 15)
      })
    })

    it("doesn't send transaction traces when collect_traces disabled", function (done) {
      var transaction = new Transaction(agent)
      transaction.finalizeNameFromUri('/test/path/31337', 501)
      agent.errors.add(transaction, new TypeError('no method last on undefined'))
      agent.errors.add(transaction, new Error('application code error'))
      agent.errors.add(transaction, new RangeError('stack depth exceeded'))
      transaction.end()

      var settings =
        nock(URL)
          .post(helper.generateCollectorPath('agent_settings', RUN_ID))
          .reply(200, {return_value: []})
      var metricData =
        nock(URL)
          .post(helper.generateCollectorPath('metric_data', RUN_ID))
          .reply(200, {return_value: []})
      var eventData =
        nock(URL)
          .post(helper.generateCollectorPath('analytic_event_data', RUN_ID))
          .reply(200, {return_value: []})
      var errorData =
        nock(URL)
          .post(helper.generateCollectorPath('error_data', RUN_ID))
          .reply(200, {return_value : null})

      // set this here so slow trace gets collected but not sent
      agent.config.onConnect({collect_traces : false})

      agent.harvest(function cb_harvest(error) {
        should.not.exist(error)

        metricData.done()
        eventData.done()
        errorData.done()

        // Wait for agent_settings command to be sent after event emitted from onConnect
        setTimeout(function() {
          settings.done()
          done()
        }, 15)
      })
    })

    it("sends transaction trace when there's a trace to send", function (done) {
      var transaction = new Transaction(agent)
      transaction.finalizeNameFromUri('/test/path/31337', 501)
      agent.errors.add(transaction, new TypeError('no method last on undefined'))
      agent.errors.add(transaction, new Error('application code error'))
      agent.errors.add(transaction, new RangeError('stack depth exceeded'))
      transaction.trace.setDurationInMillis(4001)
      transaction.end()

      var metricData =
        nock(URL)
          .post(helper.generateCollectorPath('metric_data', RUN_ID))
          .reply(200, {return_value: []})
      var eventData =
        nock(URL)
          .post(helper.generateCollectorPath('analytic_event_data', RUN_ID))
          .reply(200, {return_value: []})
      var errorData =
        nock(URL)
          .post(helper.generateCollectorPath('error_data', RUN_ID))
          .reply(200, {return_value : null})
      var transactionSampleData =
        nock(URL)
          .post(helper.generateCollectorPath('transaction_sample_data', RUN_ID))
          .reply(200, {return_value : null})

      agent.harvest(function cb_harvest(error) {
        should.not.exist(error)

        metricData.done()
        eventData.done()
        errorData.done()
        transactionSampleData.done()
        done()
      })
    })

    it("passes through errror when sending trace fails", function (done) {
      var transaction = new Transaction(agent)
      transaction.finalizeNameFromUri('/test/path/31337', 501)
      agent.errors.add(transaction, new Error('application code error'))
      transaction.trace.setDurationInMillis(4001)
      transaction.end()

      var metricData =
        nock(URL)
          .post(helper.generateCollectorPath('metric_data', RUN_ID))
          .reply(200, {return_value: []})
      var errorData =
        nock(URL)
          .post(helper.generateCollectorPath('error_data', RUN_ID))
          .reply(200, {return_value : null})
      var transactionSampleData =
        nock(URL)
          .post(helper.generateCollectorPath('transaction_sample_data', RUN_ID))
          .reply(503)

      agent.harvest(function cb_harvest(error) {
        expect(error.message)
          .equal("No body found in response to transaction_sample_data.")

        metricData.done()
        errorData.done()
        transactionSampleData.done()
        done()
      })
    })
  })


  describe("when performing harvest operations without a connection", function () {
    var agent

    beforeEach(function () {
      var config = configurator.initialize({
        license_key : 'license key here'
      })
      agent = new Agent(config)
    })

    it("should bail informatively when sending metric data", function (done) {
      var transaction = new Transaction(agent)
      agent.errors.add(transaction, new Error('application code error'))
      transaction.trace.setDurationInMillis(4001)
      transaction.finalizeNameFromUri('/test/path/31337', 501)
      transaction.end()

      agent._sendMetrics(function cb__sendMetrics(error) {
        expect(error.message).equal("not connected to New Relic (metrics will be held)")
        done()
      })
    })

    it("should bail informatively when sending error data", function (done) {
      var transaction = new Transaction(agent)
      agent.errors.add(transaction, new Error('application code error'))
      transaction.trace.setDurationInMillis(4001)
      transaction.finalizeNameFromUri('/test/path/31337', 501)
      transaction.end()

      agent._sendErrors(function cb__sendErrors(error) {
        expect(error.message).equal("not connected to New Relic (errors will be held)")
        done()
      })
    })

    it("should bail informatively when sending transaction trace", function (done) {
      var transaction = new Transaction(agent)
      agent.errors.add(transaction, new Error('application code error'))
      transaction.trace.setDurationInMillis(4001)
      transaction.finalizeNameFromUri('/test/path/31337', 501)
      transaction.end()

      agent._sendTrace(function cb__sendTrace(error) {
        expect(error.message)
          .equal("not connected to New Relic (slow trace data will be held)")
        done()
      })
    })
  })
})
