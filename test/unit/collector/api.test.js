'use strict'

const nock = require('nock')
const chai = require('chai')
const expect = chai.expect
const helper = require('../../lib/agent_helper')
const should = chai.should()
const API = require('../../../lib/collector/api')
const securityPolicies = require('../../lib/fixtures').securityPolicies

const HOST = 'collector.newrelic.com'
const PORT = 443
const URL = 'https://' + HOST
const RUN_ID = 1337

const timeout = global.setTimeout
function fast() { global.setTimeout = function(cb) {return timeout(cb, 0)} }
function slow() { global.setTimeout = timeout }

describe('CollectorAPI', function() {
  var api = null
  var agent = null
  var policies = null

  beforeEach(function() {
    nock.disableNetConnect()
    agent = helper.loadMockedAgent({
      host: HOST,
      port: PORT,
      app_name: ['TEST'],
      ssl: true,
      license_key: 'license key here',
      utilization: {
        detect_aws: false,
        detect_pcf: false,
        detect_azure: false,
        detect_gcp: false,
        detect_docker: false
      },
      browser_monitoring: {},
      transaction_tracer: {}
    })
    agent.reconfigure = function() {}
    agent.setState = function() {}
    api = new API(agent)
    policies = securityPolicies()
  })

  afterEach(function() {
    if (!nock.isDone()) {
      /* eslint-disable no-console */
      console.error('Cleaning pending mocks: %j', nock.pendingMocks())
      /* eslint-enable no-console */
      nock.cleanAll()
    }

    nock.enableNetConnect()
    helper.unloadAgent(agent)
  })

  describe('_login', function() {
    describe('when high_security: true', () => {
      beforeEach(function(done) {
        agent.config.port = 8080
        agent.config.high_security = true
        done()
      })

      afterEach(function(done) {
        agent.config.high_security = false
        done()
      })

      it('should send high_security:true in preconnect payload', (done) => {
        const expectedPreconnectBody = [{high_security: true}]

        const preconnect = nock(URL + ':8080')
          .post(helper.generateCollectorPath('preconnect'), expectedPreconnectBody)
          .reply(200, {
            return_value: {
              redirect_host: HOST
            }
          })

        const connectResponse = {return_value: {agent_run_id: RUN_ID}}
        const connect = nock(URL)
          .post(helper.generateCollectorPath('connect'))
          .reply(200, connectResponse)

        api._login(function test(err) {
          // Request will only be successful if body matches expected
          expect(err).to.be.null

          preconnect.done()
          connect.done()
          done()
        })
      })
    })

    describe('when high_security: false', () => {
      beforeEach(function(done) {
        agent.config.port = 8080
        agent.config.high_security = false
        done()
      })

      afterEach(function(done) {
        agent.config.high_security = false
        done()
      })

      it('should send high_security:false in preconnect payload', (done) => {
        const expectedPreconnectBody = [{high_security: false}]

        const preconnect = nock(URL + ':8080')
          .post(helper.generateCollectorPath('preconnect'), expectedPreconnectBody)
          .reply(200, {
            return_value: {
              redirect_host: HOST
            }
          })

        const connectResponse = {return_value: {agent_run_id: RUN_ID}}
        const connect = nock(URL)
          .post(helper.generateCollectorPath('connect'))
          .reply(200, connectResponse)

        api._login(function test(err) {
          // Request will only be successful if body matches expected
          expect(err).to.be.null

          preconnect.done()
          connect.done()
          done()
        })
      })
    })

    describe('in a LASP-enabled agent', function() {
      const SECURITY_POLICIES_TOKEN = 'TEST-TEST-TEST-TEST'

      beforeEach(function(done) {
        agent.config.port = 8080
        agent.config.security_policies_token = SECURITY_POLICIES_TOKEN
        done()
      })

      afterEach(function(done) {
        agent.config.security_policies_token = ''
        done()
      })

      // HSM should never be true when LASP/CSP enabled but payload should still be sent.
      it('should send token in preconnect payload with high_security:false', (done) => {
        const expectedPreconnectBody = [{
          security_policies_token: SECURITY_POLICIES_TOKEN,
          high_security: false
        }]

        const preconnect = nock(URL + ':8080')
          .post(helper.generateCollectorPath('preconnect'), expectedPreconnectBody)
          .reply(200, {
            return_value: {
              redirect_host: HOST,
              security_policies: {}
            }
          })

        api._login(function test(err) {
          // Request will only be successful if body matches expected
          expect(err).to.be.null

          preconnect.done()
          done()
        })
      })

      it('should fail if preconnect res is missing expected policies', function(done) {
        var redirection = nock(URL + ':8080')
          .post(helper.generateCollectorPath('preconnect'))
          .reply(200, {
            return_value: {
              redirect_host: HOST,
              security_policies: {}
            }
          })

        api._login(function test(err, response) {
          expect(err).to.be.null
          expect(response.shouldShutdownRun()).to.be.true

          redirection.done()
          done()
        })
      })

      it('should fail if agent is missing required policy', function(done) {
        policies.test = { required: true }

        var redirection = nock(URL + ':8080')
          .post(helper.generateCollectorPath('preconnect'))
          .reply(200, {
            return_value: {
              redirect_host: HOST,
              security_policies: policies
            }
          })

        api._login(function test(err, response) {
          expect(err).to.be.null
          expect(response.shouldShutdownRun()).to.be.true

          redirection.done()
          done()
        })
      })
    })

    describe('when getting request headers', function() {
      var reqHeaderMap = {
        'X-NR-TEST-HEADER': 'TEST VALUE'
      }
      var valid = {
        agent_run_id: RUN_ID,
        request_headers_map: reqHeaderMap
      }

      var response = {return_value: valid}

      it('should copy them under p17', function(done) {
        agent.config.port = 8080
        var redirection = nock(URL + ':8080')
          .post(helper.generateCollectorPath('preconnect'))
          .reply(200, {return_value: {redirect_host: HOST, security_policies: {}}})
        var connection = nock(URL)
          .post(helper.generateCollectorPath('connect'))
          .reply(200, response)

        api._login(function test() {
          expect(api._reqHeadersMap).to.deep.equal(reqHeaderMap)
          redirection.done()
          connection.done()
          done()
        })
      })
    })

    describe('on the happy path', function() {
      var bad
      var ssc

      var valid = {
        agent_run_id: RUN_ID
      }

      var response = {return_value: valid}

      beforeEach(function(done) {
        agent.config.port = 8080
        var redirection = nock(URL + ':8080')
          .post(helper.generateCollectorPath('preconnect'))
          .reply(200, {return_value: {redirect_host: HOST, security_policies: {}}})
        var connection = nock(URL)
          .post(helper.generateCollectorPath('connect'))
          .reply(200, response)

        api._login(function test(error, res) {
          bad = error
          ssc = res.payload

          redirection.done()
          connection.done()
          done()
        })
      })

      it('should not error out', function() {
        should.not.exist(bad)
      })

      it('should have a run ID', function() {
        expect(ssc.agent_run_id).equal(RUN_ID)
      })

      it('should pass through server-side configuration untouched', function() {
        expect(ssc).eql(valid)
      })
    })

    describe('off the happy path', function() {
      describe('receiving 503 response from preconnect', function() {
        let captured = null
        let response = null

        beforeEach(function(done) {
          var redirection = nock(URL)
            .post(helper.generateCollectorPath('preconnect'))
            .reply(503)

          api._login(function test(error, res) {
            captured = error
            response = res

            redirection.done()
            done()
          })
        })

        it('should not have gotten an error', function() {
          should.not.exist(captured)
        })

        it('should have passed on the status code', function() {
          expect(response.status).equal(503)
        })
      })

      describe('receiving no hostname from preconnect', function() {
        var captured
        var ssc


        before(function(done) {
          var redirection = nock(URL)
            .post(helper.generateCollectorPath('preconnect'))
            .reply(200, {return_value: {redirect_host: '', security_policies: {}}})
          var connect = nock(URL)
            .post(helper.generateCollectorPath('connect'))
            .reply(200, {return_value: {agent_run_id: RUN_ID}})

          api._login(function test(error, res) {
            captured = error
            ssc = res.payload

            redirection.done()
            connect.done()
            done()
          })
        })

        it('should have gotten no error', function() {
          should.not.exist(captured)
        })

        it('should use preexisting collector hostname', function() {
          expect(api._agent.config.host).equal(HOST)
        })

        it('should pass along server-side configuration from collector', function() {
          expect(ssc).eql({agent_run_id: RUN_ID})
        })
      })

      describe('receiving a weirdo redirect name from preconnect', function() {
        var captured
        var ssc


        before(function(done) {
          var redirection = nock(URL)
            .post(helper.generateCollectorPath('preconnect'))
            .reply(200, {
              return_value: {
                redirect_host: HOST + ':chug:8089',
                security_policies: {}
              }
            })
          var connect = nock(URL)
            .post(helper.generateCollectorPath('connect'))
            .reply(200, {return_value: {agent_run_id: RUN_ID}})

          api._login(function test(error, res) {
            captured = error
            ssc = res.payload

            redirection.done()
            connect.done()
            done()
          })
        })

        it('should have gotten no error', function() {
          should.not.exist(captured)
        })

        it('should use preexisting collector hostname', function() {
          expect(api._agent.config.host).equal(HOST)
        })

        it('should use preexisting collector port number', function() {
          expect(api._agent.config.port).equal(PORT)
        })

        it('should pass along server-side configuration from collector', function() {
          expect(ssc).eql({agent_run_id: RUN_ID})
        })
      })

      describe('receiving no config back from connect', function() {
        var captured
        var ssc


        before(function(done) {
          var redirection = nock(URL)
            .post(helper.generateCollectorPath('preconnect'))
            .reply(200, {
              return_value: {redirect_host: HOST, security_policies: {}}
            })
          var connect = nock(URL)
            .post(helper.generateCollectorPath('connect'))
            .reply(200, {return_value: null})

          api._login(function test(error, config) {
            captured = error
            ssc = config.payload

            redirection.done()
            connect.done()
            done()
          })
        })

        it('should have gotten an error', function() {
          should.exist(captured)
        })

        it('should have gotten an informative error message', function() {
          expect(captured.message).equal('No agent run ID received from handshake.')
        })

        it('should pass along no server-side configuration from collector', function() {
          should.not.exist(ssc)
        })
      })

      describe('receiving 503 response from connect', function() {
        let captured = null
        let response = null

        before(function(done) {
          var redirection = nock(URL)
            .post(helper.generateCollectorPath('preconnect'))
            .reply(200, {
              return_value: {redirect_host: HOST, security_policies: {}}
            })
          var connection = nock(URL)
            .post(helper.generateCollectorPath('connect'))
            .reply(503)

          api._login(function test(error, res) {
            captured = error
            response = res

            redirection.done()
            connection.done()
            done()
          })
        })

        it('should not have gotten an error', function() {
          expect(captured).to.be.null
        })

        it('should have passed on the status code', function() {
          expect(response.status).equal(503)
        })
      })

      describe('receiving 200 response to connect but no data', function() {
        var captured


        before(function(done) {
          var redirection = nock(URL)
            .post(helper.generateCollectorPath('preconnect'))
            .reply(200, {
              return_value: {redirect_host: HOST, security_policies: {}}
            })
          var connection = nock(URL)
            .post(helper.generateCollectorPath('connect'))
            .reply(200)

          api._login(function test(error) {
            captured = error

            redirection.done()
            connection.done()
            done()
          })
        })

        it('should have gotten an error', function() {
          should.exist(captured)
        })

        it('should have included an informative error message', function() {
          expect(captured.message).to.equal('No agent run ID received from handshake.')
        })
      })
    })
  })

  describe('connect', function() {
    it('requires a callback', function() {
      expect(function() { api.connect(null) }).to.throw('callback is required')
    })

    describe('in a LASP-enabled agent', function() {
      beforeEach(function() {
        agent.config.port = 8080
        agent.config.security_policies_token = 'TEST-TEST-TEST-TEST'
      })

      afterEach(function() {
        agent.config.security_policies_token = ''
      })

      it('should include security policies in api callback response', function(done) {
        var valid = {
          agent_run_id: RUN_ID,
          security_policies: policies
        }
        var response = {return_value: valid}

        var redirection = nock(URL + ':8080')
          .post(helper.generateCollectorPath('preconnect'))
          .reply(200, {
            return_value: {
              redirect_host: HOST,
              security_policies: policies
            }
          })
        var connection = nock(URL)
          .post(helper.generateCollectorPath('connect'))
          .reply(200, response)

        api.connect(function test(error, res) {
          expect(res).property('payload').to.deep.equal(valid)

          redirection.done()
          connection.done()
          done()
        })
      })

      it('drops data collected before connect when policies are updated', function(done) {
        agent.config.transaction_tracer.record_sql = 'raw'
        agent.config.api.custom_events_enabled = true

        agent.customEventAggregator.add(['will be overwritten'])
        expect(agent.customEventAggregator.length).to.equal(1)

        var valid = {
          agent_run_id: RUN_ID,
          security_policies: policies
        }
        var response = {return_value: valid}

        var redirection = nock(URL + ':8080')
          .post(helper.generateCollectorPath('preconnect'))
          .reply(200, {
            return_value: {
              redirect_host: HOST,
              security_policies: policies
            }
          })
        var connection = nock(URL)
          .post(helper.generateCollectorPath('connect'))
          .reply(200, response)

        api.connect(function test(error, res) {
          expect(res).property('payload').to.deep.equal(valid)
          expect(agent.queries).to.not.equal('will be overwritten')
          expect(agent.customEventAggregator.length).to.equal(0)

          redirection.done()
          connection.done()
          done()
        })
      })
    })

    describe('on the happy path', function() {
      describe('succeeds immediately, the same as _login', function() {
        var bad
        var ssc

        var valid = {
          agent_run_id: RUN_ID
        }

        var response = {return_value: valid}

        before(function(done) {
          var redirection = nock(URL)
            .post(helper.generateCollectorPath('preconnect'))
            .reply(200, {
              return_value: {redirect_host: HOST, security_policies: {}}
            })
          var connection = nock(URL)
            .post(helper.generateCollectorPath('connect'))
            .reply(200, response)

          api.connect(function test(error, res) {
            bad = error
            ssc = res.payload

            redirection.done()
            connection.done()
            done()
          })
        })

        it('should not error out', function() {
          should.not.exist(bad)
        })

        it('should pass through server-side configuration untouched', function() {
          expect(ssc).eql(valid)
        })
      })

      describe('succeeds when given a non-80 port number for redirect', function() {
        var bad
        var ssc


        var valid = {
          agent_run_id: RUN_ID
        }

        var response = {return_value: valid}

        beforeEach(function(done) {
          var redirection = nock(URL)
            .post(helper.generateCollectorPath('preconnect'))
            .reply(200, {
              return_value: {
                redirect_host: HOST + ':8089',
                security_policies: {}
              }
            })
          var connection = nock(URL + ':8089')
            .post(helper.generateCollectorPath('connect'))
            .reply(200, response)

          api.connect(function test(error, res) {
            bad = error
            ssc = res.payload

            redirection.done()
            connection.done()
            done()
          })
        })

        // the port number gets changed, so reset it
        after(function() {
          api._agent.config.port = 80
        })

        it('should not error out', function() {
          should.not.exist(bad)
        })

        it('should have the correct hostname', function() {
          expect(api._agent.config.host).equal(HOST)
        })

        it('should have the correct port number', function() {
          expect(api._agent.config.port).equal('8089')
        })

        it('should have a run ID', function() {
          expect(ssc.agent_run_id).equal(RUN_ID)
        })

        it('should pass through server-side configuration untouched', function() {
          expect(ssc).eql(valid)
        })
      })

      describe('succeeds after one 503 on preconnect', function() {
        var bad
        var ssc


        var valid = {
          agent_run_id: RUN_ID
        }

        var response = {return_value: valid}

        beforeEach(function(done) {
          fast()

          var redirectURL = helper.generateCollectorPath('preconnect')
          var failure = nock(URL).post(redirectURL).reply(503)
          var success = nock(URL)
            .post(redirectURL)
            .reply(200, {
              return_value: {redirect_host: HOST, security_policies: {}}
            })
          var connection = nock(URL)
            .post(helper.generateCollectorPath('connect'))
            .reply(200, response)


          api.connect(function test(error, res) {
            bad = error
            ssc = res.payload

            failure.done()
            success.done()
            connection.done()
            done()
          })
        })

        afterEach(function() {
          slow()
        })

        it('should not error out', function() {
          should.not.exist(bad)
        })

        it('should have a run ID', function() {
          expect(ssc.agent_run_id).equal(RUN_ID)
        })

        it('should pass through server-side configuration untouched', function() {
          expect(ssc).eql(valid)
        })
      })

      describe('succeeds after five 503s on preconnect', function() {
        var bad
        var ssc


        var valid = {
          agent_run_id: RUN_ID
        }

        var response = {return_value: valid}

        before(function(done) {
          fast()

          var redirectURL = helper.generateCollectorPath('preconnect')
          var failure = nock(URL).post(redirectURL).times(5).reply(503)
          var success = nock(URL)
            .post(redirectURL)
            .reply(200, {
              return_value: {redirect_host: HOST, security_policies: {}}
            })
          var connection = nock(URL)
            .post(helper.generateCollectorPath('connect'))
            .reply(200, response)


          api.connect(function test(error, res) {
            bad = error
            ssc = res.payload

            failure.done()
            success.done()
            connection.done()
            done()
          })
        })

        after(function() {
          slow()
        })

        it('should not error out', function() {
          should.not.exist(bad)
        })

        it('should have a run ID', function() {
          expect(ssc.agent_run_id).equal(RUN_ID)
        })

        it('should pass through server-side configuration untouched', function() {
          expect(ssc).eql(valid)
        })
      })
    })

    describe('off the happy path', function() {
      var exception = {
        exception: {
          message: 'fake force disconnect',
          error_type: 'NewRelic::Agent::ForceDisconnectException'
        }
      }

      before(function() {
        fast()
      })

      after(function() {
        slow()
      })

      describe('fails after receiving force disconnect', function() {
        var captured = null
        var res = null

        beforeEach(function(done) {
          var redirectURL = helper.generateCollectorPath('preconnect')
          var failure = nock(URL).post(redirectURL).times(1).reply(410, exception)

          api.connect(function test(error, response) {
            captured = error
            res = response

            failure.done()
            done()
          })
        })

        it('should not have gotten an error', function() {
          expect(captured).to.be.null
        })

        it('should not have a response body', function() {
          expect(res.payload).to.not.exist
        })
      })

      describe('retries preconnect until forced to disconnect (410)', function() {
        var captured = null

        before(function(done) {
          var redirectURL = helper.generateCollectorPath('preconnect')
          var failure = nock(URL).post(redirectURL).times(500).reply(503)
          var disconnect = nock(URL).post(redirectURL).times(1).reply(410, exception)
          api.connect(function test(error) {
            captured = error

            failure.done()
            disconnect.done()
            done()
          })
        })

        it('should have gotten an error', function() {
          expect(captured).to.be.null
        })
      })

      describe('retries on receiving invalid license key (401)', function() {
        var failure = null
        let success = null
        let connect = null
        var error = {
          exception: {
            message: 'Invalid license key. Please contact support@newrelic.com.',
            error_type: 'NewRelic::Agent::LicenseException'
          }
        }

        beforeEach(function(done) {
          var preconnectURL = helper.generateCollectorPath('preconnect')
          failure = nock(URL).post(preconnectURL).times(5).reply(401, error)
          success = nock(URL).post(preconnectURL).reply(200, {return_value: {}})
          connect = nock(URL)
            .post(helper.generateCollectorPath('connect'))
            .reply(200, {return_value: {agent_run_id: 31338}})

          api.connect(function test() {
            failure.done()
            success.done()
            connect.done()
            done()
          })
        })

        it('should call the expected number of times', function() {
          failure.done()
        })
      })
    })
  })

  describe('reportSettings', function() {
    var bad
    var res
    var payload = {return_value: []}

    before(function(done) {
      api._agent.config.run_id = RUN_ID

      var mock = nock(URL)
        .post(helper.generateCollectorPath('agent_settings', RUN_ID))
        .reply(200, payload)

      api.reportSettings(function test(error, response) {
        bad = error
        res = response
        mock.done()
        done()
      })
    })

    after(function() {
      api._agent.config.run_id = undefined
    })

    it('should not error out', function() {
      should.not.exist(bad)
    })

    it('should return the expected `empty` response', function() {
      expect(res.payload).eql(payload.return_value)
    })
  })

  describe('errorData', function() {
    it('requires errors to send', (done) => {
      api.error_data(null, (err) => {
        expect(err)
          .to.be.an.instanceOf(Error)
          .and.have.property('message', 'must pass errors to send')
        done()
      })
    })

    it('requires a callback', function() {
      expect(function() { api.error_data([], null) })
        .to.throw('callback is required')
    })

    describe('on the happy path', function() {
      let bad = null
      let command = null
      var response = {return_value: []}

      before(function(done) {
        api._agent.config.run_id = RUN_ID
        var shutdown = nock(URL)
          .post(helper.generateCollectorPath('error_data', RUN_ID))
          .reply(200, response)

        var errors = [
          [
            0,                          // timestamp, which is always ignored
            'TestTransaction/Uri/TEST', // transaction name
            'You done screwed up',      // helpful, informative message
            'SampleError',              // Error type (almost always Error in practice)
            {},                         // request parameters
          ]
        ]

        api.error_data(errors, function test(error, res) {
          bad = error
          command = res

          shutdown.done()
          done()
        })
      })

      after(function() {
        api._agent.config.run_id = undefined
      })

      it('should not error out', function() {
        should.not.exist(bad)
      })

      it('should return retain state', function() {
        expect(command).to.have.property('retainData').eql(false)
      })
    })
  })

  describe('sql_trace_data', function() {
    it('requires queries to send', (done) => {
      api.sql_trace_data(null, (err) => {
        expect(err)
          .to.be.an.instanceOf(Error)
          .and.have.property('message', 'must pass queries to send')
        done()
      })
    })

    it('requires a callback', function() {
      expect(function() { api.sql_trace_data([], null) })
        .to.throw('callback is required')
    })

    describe('on the happy path', function() {
      let bad = null

      var response = {return_value: []}

      before(function(done) {
        api._agent.config.run_id = RUN_ID
        var shutdown = nock(URL)
          .post(helper.generateCollectorPath('sql_trace_data', RUN_ID))
          .reply(200, response)

        var queries = [
          [
            'TestTransaction/Uri/TEST',
            '/TEST',
            1234,
            'select * from foo',
            '/Datastore/Mysql/select/foo',
            1,
            700,
            700,
            700,
            'compressed/bas64 params'
          ]
        ]

        api.sql_trace_data(queries, function test(error) {
          bad = error

          shutdown.done()
          done()
        })
      })

      after(function() {
        api._agent.config.run_id = undefined
      })

      it('should not error out', function() {
        should.not.exist(bad)
      })
    })
  })

  describe('analyticsEvents', function() {
    it('requires errors to send', (done) => {
      api.analytic_event_data(null, (err) => {
        expect(err)
          .to.be.an.instanceOf(Error)
          .and.have.property('message', 'must pass events to send')
        done()
      })
    })

    it('requires a callback', function() {
      expect(function() { api.analytic_event_data([], null) })
        .to.throw('callback is required')
    })

    describe('on the happy path', function() {
      let bad = null
      let command = null

      var response = {return_value: []}

      before(function(done) {
        api._agent.config.run_id = RUN_ID
        var endpoint = nock(URL)
          .post(helper.generateCollectorPath('analytic_event_data', RUN_ID))
          .reply(200, response)

        var transactionEvents = [
          RUN_ID,
          [{
            'webDuration': 1.0,
            'timestamp': 1000,
            'name': 'Controller/rails/welcome/index',
            'duration': 1.0,
            'type': 'Transaction'
          },{
            'A': 'a',
            'B': 'b',
          }]
        ]

        api.analytic_event_data(transactionEvents, function test(error, res) {
          bad = error
          command = res

          endpoint.done()
          done()
        })
      })

      after(function() {
        api._agent.config.run_id = undefined
      })

      it('should not error out', function() {
        should.not.exist(bad)
      })

      it('should return retain state', function() {
        expect(command).to.have.property('retainData').eql(false)
      })
    })
  })

  describe('metricData', function() {
    it('requires metrics to send', (done) => {
      api.metric_data(null, (err) => {
        expect(err)
          .to.be.an.instanceOf(Error)
          .and.have.property('message', 'must pass metrics to send')
        done()
      })
    })

    it('requires a callback', function() {
      expect(function() { api.metric_data([], null) })
        .to.throw('callback is required')
    })

    describe('on the happy path', function() {
      let bad = null
      let command = null

      var response = {return_value: []}

      before(function(done) {
        api._agent.config.run_id = RUN_ID
        var shutdown = nock(URL)
          .post(helper.generateCollectorPath('metric_data', RUN_ID))
          .reply(200, response)

        // would like to keep this set of tests relatively self-contained
        var metrics = {
          toJSON: function() {
            return [
              [{name: 'Test/Parent'},  [1,0.026,0.006,0.026,0.026,0.000676]],
              [{name: 'Test/Child/1'}, [1,0.012,0.012,0.012,0.012,0.000144]],
              [{name: 'Test/Child/2'}, [1,0.008,0.008,0.008,0.008,0.000064]]
            ]
          }
        }

        api.metric_data(metrics, function test(error, res) {
          bad = error
          command = res

          shutdown.done()
          done()
        })
      })

      after(function() {
        api._agent.config.run_id = undefined
      })

      it('should not error out', function() {
        should.not.exist(bad)
      })

      it('should return empty data array', function() {
        expect(command).to.have.property('retainData', false)
      })
    })
  })

  describe('transaction_sample_data', function() {
    it('requires slow trace data to send', (done) => {
      api.transaction_sample_data(null, (err) => {
        expect(err)
          .to.be.an.instanceOf(Error)
          .and.have.property('message', 'must pass traces to send')
        done()
      })
    })

    it('requires a callback', function() {
      expect(function() { api.transaction_sample_data([], null) })
        .to.throw('callback is required')
    })

    describe('on the happy path', function() {
      let bad = null

      var response = {return_value: []}

      before(function(done) {
        api._agent.config.run_id = RUN_ID
        var shutdown = nock(URL)
          .post(helper.generateCollectorPath('transaction_sample_data', RUN_ID))
          .reply(200, response)

        // imagine this is a serialized transaction trace
        var trace = []

        api.transaction_sample_data([trace], function test(error) {
          bad = error

          shutdown.done()
          done()
        })
      })

      after(function() {
        api._agent.config.run_id = undefined
      })

      it('should not error out', function() {
        should.not.exist(bad)
      })
    })
  })

  describe('shutdown', function() {
    it('requires a callback', function() {
      expect(function() { api.shutdown(null) }).to.throw('callback is required')
    })

    describe('on the happy path', function() {
      var bad = null
      var command = null

      var response = {return_value: null}

      before(function(done) {
        api._agent.config.run_id = RUN_ID
        var shutdown = nock(URL)
          .post(helper.generateCollectorPath('shutdown', RUN_ID))
          .reply(200, response)

        api.shutdown(function test(error, res) {
          bad = error
          command = res

          shutdown.done()
          done()
        })
      })

      after(function() {
        api._agent.config.run_id = undefined
      })

      it('should not error out', function() {
        should.not.exist(bad)
      })

      it('should return null', function() {
        expect(command).to.exist.and.have.property('payload', null)
      })
    })

    describe('off the happy path', function() {
      describe('fails on a 503 status code', function() {
        var captured = null
        var command = null

        beforeEach(function(done) {
          api._agent.config.run_id = RUN_ID
          var failure = nock(URL)
            .post(helper.generateCollectorPath('shutdown', RUN_ID))
            .reply(503)

          api.shutdown(function test(error, response) {
            captured = error
            command = response

            failure.done()
            done()
          })
        })

        afterEach(function() {
          api._agent.config.run_id = undefined
        })

        it('should have gotten an error', function() {
          expect(captured).to.be.null
        })

        it('should no longer have agent run id', function() {
          expect(api._agent.config.run_id).to.be.undefined
        })

        it('should tell the requester to shut down', () => {
          expect(command.shouldShutdownRun()).to.be.true
        })
      })
    })
  })

  describe('_runLifecycle', function() {
    let method = null

    beforeEach(function() {
      agent.config.run_id = 31337
      delete agent.reconfigure
      agent.stop = function(cb) {
        api.shutdown(cb)
      }

      method = api._methods.metrics
    })

    it('should bail out if disconnected', function(done) {
      api._agent.config.run_id = undefined

      function tested(error) {
        should.exist(error)
        expect(error.message).equals('Not connected to collector.')

        done()
      }

      api._runLifecycle(method, null, tested)
    })

    it('should discard HTTP 413 errors', function(done) {
      var failure = nock(URL)
        .post(helper.generateCollectorPath('metric_data', 31337))
        .reply(413)
      function tested(error) {
        should.not.exist(error)

        failure.done()
        done()
      }

      api._runLifecycle(method, null, tested)
    })

    it('should discard HTTP 415 errors', function(done) {
      var failure = nock(URL)
        .post(helper.generateCollectorPath('metric_data', 31337))
        .reply(415)
      function tested(error) {
        should.not.exist(error)

        failure.done()
        done()
      }

      api._runLifecycle(method, null, tested)
    })

    it('should discard 413 exceptions', function(done) {
      var failure = nock(URL)
        .post(helper.generateCollectorPath('metric_data', 31337))
        .reply(413)
      function tested(error, command) {
        should.not.exist(error)
        expect(command).to.have.property('retainData', false)

        failure.done()
        done()
      }

      api._runLifecycle(method, null, tested)
    })

    it('should retain after HTTP 500 errors', function(done) {
      var failure = nock(URL)
        .post(helper.generateCollectorPath('metric_data', 31337))
        .reply(500)
      function tested(error, command) {
        expect(error).to.not.exist
        expect(command).to.have.property('retainData', true)

        failure.done()
        done()
      }

      api._runLifecycle(method, null, tested)
    })

    it('should retain after HTTP 503 errors', function(done) {
      var failure = nock(URL)
        .post(helper.generateCollectorPath('metric_data', 31337))
        .reply(503)
      function tested(error, command) {
        expect(error).to.not.exist
        expect(command).to.have.property('retainData', true)

        failure.done()
        done()
      }

      api._runLifecycle(method, null, tested)
    })

    it('should indicate a restart and discard data after 401 errors', (done) => {
      // Call fails.
      const metrics = nock(URL)
        .post(helper.generateCollectorPath('metric_data', 31337))
        .reply(401)

      // Execute!
      api._runLifecycle(method, null, (error, command) => {
        expect(error).to.not.exist

        metrics.done()

        expect(command).to.have.property('retainData', false)
        expect(command.shouldRestartRun()).to.be.true

        done()
      })
    })

    describe('on 409 status', function() {
      it('should indicate reconnect and discard data', function(done) {
        const restart = nock(URL)
          .post(helper.generateCollectorPath('metric_data', 31337))
          .reply(409, {return_value: {}})

        api._runLifecycle(method, null, function(error, command) {
          if (error) {
            console.error(error.stack) // eslint-disable-line no-console
          }
          expect(error).to.not.exist
          expect(command).to.have.property('retainData', false)
          expect(command.shouldRestartRun()).to.be.true

          restart.done()
          done()
        })
      })
    })

    it('should stop the agent on 410 (force disconnect)', function(done) {
      var restart = nock(URL)
        .post(helper.generateCollectorPath('metric_data', 31337))
        .reply(410)
      var shutdown = nock(URL)
        .post(helper.generateCollectorPath('shutdown', 31337))
        .reply(200, {return_value: null})

      function tested(error, command) {
        expect(error).to.not.exist
        expect(command.shouldShutdownRun()).to.be.true

        expect(api._agent.config).property('run_id').to.not.exist

        restart.done()
        shutdown.done()
        done()
      }

      api._runLifecycle(method, null, tested)
    })

    it('should retain data after maintenance notices', function(done) {
      var exception = {
        exception: {
          message: 'Out for a smoke beeearrrbeee',
          error_type: 'NewRelic::Agent::MaintenanceError'
        }
      }

      var failure = nock(URL)
        .post(helper.generateCollectorPath('metric_data', 31337))
        .reply(503, exception)
      function tested(error, command) {
        expect(error).to.not.exist
        expect(command).to.have.property('retainData', true)

        failure.done()
        done()
      }

      api._runLifecycle(method, null, tested)
    })

    it('should retain data after runtime errors', function(done) {
      var exception = {
        exception: {
          message: 'What does this button do?',
          error_type: 'RuntimeError'
        }
      }

      var failure = nock(URL)
        .post(helper.generateCollectorPath('metric_data', 31337))
        .reply(500, exception)
      function tested(error, command) {
        expect(error).to.not.exist
        expect(command).to.have.property('retainData', true)

        failure.done()
        done()
      }

      api._runLifecycle(method, null, tested)
    })

    it('should not retain data after unexpected errors', function(done) {
      var failure = nock(URL)
        .post(helper.generateCollectorPath('metric_data', 31337))
        .reply(501)
      function tested(error, command) {
        expect(error).to.not.exist
        expect(command).to.have.property('retainData', false)

        failure.done()
        done()
      }

      api._runLifecycle(method, null, tested)
    })
  })
})
