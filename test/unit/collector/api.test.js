'use strict'

var nock = require('nock')
var chai = require('chai')
var expect = chai.expect
var helper = require('../../lib/agent_helper')
var should = chai.should()
var API = require('../../../lib/collector/api')
var securityPolicies = require('../../lib/fixtures').securityPolicies


var HOST = 'collector.newrelic.com'
var PORT = 443
var URL = 'https://' + HOST
var RUN_ID = 1337

var timeout = global.setTimeout
function fast() { global.setTimeout = function(cb) {return timeout(cb, 0)} }
function slow() { global.setTimeout = timeout }

describe('CollectorAPI', function() {
  var api = null
  var agent = null
  var policies = null

  beforeEach(function() {
    nock.disableNetConnect()
    agent = helper.loadMockedAgent(null, {
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
    nock.enableNetConnect()
    helper.unloadAgent(agent)
  })

  describe('_login', function() {
    describe('in a LASP-enabled agent', function() {
      beforeEach(function(done) {
        agent.config.port = 8080
        agent.config.security_policies_token = 'TEST-TEST-TEST-TEST'
        done()
      })

      afterEach(function(done) {
        agent.config.security_policies_token = ''
        done()
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

        api._login(function test(err) {
          expect(err.message).to.contain('did not receive one or more security policies')

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

        api._login(function test(err) {
          expect(err.message).to.contain('received one or more required security')

          redirection.done()
          done()
        })
      })
    })

    describe('on the happy path', function() {
      var bad
      var ssc
      var raw

      var valid = {
        capture_params: true,
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

        api._login(function test(error, config, json) {
          bad = error
          ssc = config
          raw = json

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

      it('should pass through exactly what it got back from the server', function() {
        expect(raw).eql(response)
      })
    })

    describe('off the happy path', function() {
      describe('receiving 503 response from preconnect', function() {
        var captured

        before(function(done) {
          var redirection = nock(URL)
            .post(helper.generateCollectorPath('preconnect'))
            .reply(503)

          api._login(function test(error) {
            captured = error

            redirection.done()
            done()
          })
        })

        it('should have gotten an error', function() {
          should.exist(captured)
        })

        it('should have passed on the status code', function() {
          expect(captured.statusCode).equal(503)
        })

        it('should have included an informative error message', function() {
          expect(captured.message)
            .equal('No body found in response to preconnect.')
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

          api._login(function test(error, config) {
            captured = error
            ssc = config

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

          api._login(function test(error, config) {
            captured = error
            ssc = config

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
            ssc = config

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
        var captured

        before(function(done) {
          var redirection = nock(URL)
            .post(helper.generateCollectorPath('preconnect'))
            .reply(200, {
              return_value: {redirect_host: HOST, security_policies: {}}
            })
          var connection = nock(URL)
            .post(helper.generateCollectorPath('connect'))
            .reply(503)

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

        it('should have passed on the status code', function() {
          expect(captured.statusCode).equal(503)
        })

        it('should have included an informative error message', function() {
          expect(captured.message)
            .equal('No body found in response to connect.')
        })
      })

      describe('receiving 200 response to preconnect but no data', function() {
        var captured
        var data
        var raw


        before(function(done) {
          var redirection = nock(URL)
            .post(helper.generateCollectorPath('preconnect'))
            .reply(200)

          api._login(function test(error, response, json) {
            captured = error
            data = response
            raw = json

            redirection.done()
            done()
          })
        })

        it('should have gotten an error', function() {
          should.exist(captured)
        })

        it('should have paseed on the status code', function() {
          expect(captured.statusCode).equal(200)
        })

        it('should have included an informative error message', function() {
          expect(captured.message)
            .equal('No body found in response to preconnect.')
        })

        it('should have no return_value', function() {
          should.not.exist(data)
        })

        it('should have passed along (empty) body', function() {
          should.not.exist(raw)
        })
      })

      describe('receiving 200 response to connect but no data', function() {
        var captured
        var data
        var raw


        before(function(done) {
          var redirection = nock(URL)
            .post(helper.generateCollectorPath('preconnect'))
            .reply(200, {
              return_value: {redirect_host: HOST, security_policies: {}}
            })
          var connection = nock(URL)
            .post(helper.generateCollectorPath('connect'))
            .reply(200)

          api._login(function test(error, response, json) {
            captured = error
            data = response
            raw = json

            redirection.done()
            connection.done()
            done()
          })
        })

        it('should have gotten an error', function() {
          should.exist(captured)
        })

        it('should not have a status code on the error', function() {
          expect(captured.statusCode).equal(200)
        })

        it('should have included an informative error message', function() {
          expect(captured.message).to.equal('No body found in response to connect.')
        })

        it('should have no return_value', function() {
          should.not.exist(data)
        })

        it('should have passed along (empty) body', function() {
          should.not.exist(raw)
        })
      })

      describe('receiving InvalidLicenseKey after preconnect', function() {
        var captured
        var data
        var raw


        var response = {
          exception: {
            message: 'Invalid license key. Please contact support@newrelic.com.',
            error_type: 'NewRelic::Agent::LicenseException'
          }
        }

        before(function(done) {
          var redirection = nock(URL)
            .post(helper.generateCollectorPath('preconnect'))
            .reply(200, response)

          api._login(function test(error, res, json) {
            captured = error
            data = res
            raw = json

            redirection.done()
            done()
          })
        })

        it('should have gotten an error', function() {
          should.exist(captured)
        })

        it('should have a status code on the error', function() {
          expect(captured.statusCode).equal(200)
        })

        it('should have included an informative error message', function() {
          expect(captured.message)
            .equal('Invalid license key. Please contact support@newrelic.com.')
        })

        it('should have included the New Relic error class', function() {
          expect(captured.class).to.equal('NewRelic::Agent::LicenseException')
        })

        it('should have no return value', function() {
          should.not.exist(data)
        })

        it('should have passed along raw response', function() {
          expect(raw).eql(response)
        })
      })
    })
  })

  describe('connect', function() {
    it('requires a callback', function() {
      expect(function() { api.connect(null) }).to.throw('callback is required')
    })

    describe('in a LASP-enabled agent', function() {
      beforeEach(function(done) {
        agent.config.port = 8080
        agent.config.security_policies_token = 'TEST-TEST-TEST-TEST'
        done()
      })

      afterEach(function(done) {
        agent.config.security_policies_token = ''
        done()
      })

      it('should include security policies in connect response', function(done) {
        var valid = {
          capture_params: true,
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

        api.connect(function test(error, config, json) {
          expect(json).to.deep.equal(response)

          redirection.done()
          connection.done()
          done()
        })
      })

      it('drops data collected before connect when policies are updated', function(done) {
        agent.config.transaction_tracer.record_sql = 'raw'
        agent.config.api.custom_events_enabled = true

        agent.queries = 'will be overwritten'
        agent.customEvents = 'will be overwritten'

        var valid = {
          capture_params: true,
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

        api.connect(function test(error, config, json) {
          expect(json).to.deep.equal(response)
          expect(agent.queries).to.not.equal('will be overwritten')
          expect(agent.customEvents).to.not.equal('will be overwritten')

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
        var raw


        var valid = {
          capture_params: true,
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

          api.connect(function test(error, res, json) {
            bad = error
            ssc = res
            raw = json

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

        it('should pass through exactly what it got back from the server', function() {
          expect(raw).eql(response)
        })
      })

      describe('succeeds when given a non-80 port number for redirect', function() {
        var bad
        var ssc
        var raw


        var valid = {
          capture_params: true,
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

          api.connect(function test(error, res, json) {
            bad = error
            ssc = res
            raw = json

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

        it('should pass through exactly what it got back from the server', function() {
          expect(raw).eql(response)
        })
      })

      describe('succeeds after one 503 on preconnect', function() {
        var bad
        var ssc
        var raw


        var valid = {
          capture_params: true,
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


          api.connect(function test(error, res, json) {
            bad = error
            ssc = res
            raw = json

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

        it('should pass through exactly what it got back from the server', function() {
          expect(raw).eql(response)
        })
      })

      describe('succeeds after five 503s on preconnect', function() {
        var bad
        var ssc
        var raw


        var valid = {
          capture_params: true,
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


          api.connect(function test(error, res, json) {
            bad = error
            ssc = res
            raw = json

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

        it('should pass through exactly what it got back from the server', function() {
          expect(raw).eql(response)
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
        var body = null

        before(function(done) {
          var redirectURL = helper.generateCollectorPath('preconnect')
          var failure = nock(URL).post(redirectURL).times(1).reply(503, exception)

          api.connect(function test(error, response) {
            captured = error
            body = response

            failure.done()
            done()
          })
        })

        it('should have gotten an error', function() {
          expect(captured).to.exist
        })

        it('should have passed on the status code', function() {
          expect(captured.statusCode).to.equal(503)
        })

        it('should have included an informative error message', function() {
          expect(captured.message)
            .to.equal('fake force disconnect')
        })

        it('should not have a response body', function() {
          expect(body).to.not.exist
        })
      })

      describe('retries preconnect until forced to disconnect', function() {
        var captured = null
        var body = null

        before(function(done) {
          var redirectURL = helper.generateCollectorPath('preconnect')
          var failure = nock(URL).post(redirectURL).times(500).reply(503)
          var disconnect = nock(URL).post(redirectURL).times(1).reply(503, exception)
          api.connect(function test(error, response) {
            captured = error
            body = response

            failure.done()
            disconnect.done()
            done()
          })
        })

        it('should have gotten an error', function() {
          expect(captured).to.exist
        })

        it('should have passed on the status code', function() {
          expect(captured.statusCode).to.equal(503)
        })

        it('should have included an informative error message', function() {
          expect(captured.message)
            .to.equal('fake force disconnect')
        })

        it('should not have a response body', function() {
          expect(body).to.not.exist
        })
      })

      describe('fails on receiving InvalidLicenseKey', function() {
        var captured = null
        var data = null
        var raw = null
        var failure = null
        var error = {
          exception: {
            message: 'Invalid license key. Please contact support@newrelic.com.',
            error_type: 'NewRelic::Agent::LicenseException'
          }
        }

        before(function(done) {
          var redirectURL = helper.generateCollectorPath('preconnect')
          failure = nock(URL).post(redirectURL).times(1).reply(200, error)

          api.connect(function test(error, response, json) {
            captured = error
            data = response
            raw = json

            failure.done()
            done()
          })
        })

        it('should call the expected number of times', function() {
          failure.done()
        })

        it('should have gotten an error', function() {
          should.exist(captured)
        })

        it('should have a status code on the error', function() {
          expect(captured.statusCode).equal(200)
        })

        it('should have included an informative error message', function() {
          expect(captured.message)
            .equal('Invalid license key. Please contact support@newrelic.com.')
        })

        it('should have included the New Relic error class', function() {
          expect(captured.class).to.equal('NewRelic::Agent::LicenseException')
        })

        it('should have no return value', function() {
          should.not.exist(data)
        })

        it('should have passed along raw response', function() {
          expect(raw).eql(error)
        })
      })

      describe('fails on receiving InvalidLicenseKey after one 503', function() {
        var captured = null
        var data = null
        var raw = null
        var failure = null
        var license = null
        var error = {
          exception: {
            message: 'Invalid license key. Please contact support@newrelic.com.',
            error_type: 'NewRelic::Agent::LicenseException'
          }
        }

        before(function(done) {
          var redirectURL = helper.generateCollectorPath('preconnect')
          failure = nock(URL).post(redirectURL).reply(503)
          license = nock(URL).post(redirectURL).times(1).reply(200, error)

          api.connect(function test(error, response, json) {
            captured = error
            data = response
            raw = json

            done()
          })
        })

        it('should call the expected number of times', function() {
          failure.done()
          license.done()
        })

        it('should have gotten an error', function() {
          should.exist(captured)
        })

        it('should have a status code on the error', function() {
          expect(captured.statusCode).equal(200)
        })

        it('should have included an informative error message', function() {
          expect(captured.message)
            .equal('Invalid license key. Please contact support@newrelic.com.')
        })

        it('should have included the New Relic error class', function() {
          expect(captured.class).to.equal('NewRelic::Agent::LicenseException')
        })

        it('should have no return value', function() {
          should.not.exist(data)
        })

        it('should have passed along raw response', function() {
          expect(raw).eql(error)
        })
      })
    })
  })

  describe('reportSettings', function() {
    var bad
    var raw
    var response = {return_value: []}

    before(function(done) {
      api._agent.config.run_id = RUN_ID

      var mock = nock(URL)
        .post(helper.generateCollectorPath('agent_settings', RUN_ID))
        .reply(200, response)

      api.reportSettings(function test(error, json) {
        bad = error
        raw = json
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
      expect(raw).eql(response)
    })
  })

  describe('errorData', function() {
    it('requires errors to send', function() {
      expect(function() { api.errorData(null, function() {}) })
        .to.throw('must pass errors to send')
    })

    it('requires a callback', function() {
      expect(function() { api.errorData([], null) })
        .to.throw('callback is required')
    })

    describe('on the happy path', function() {
      var bad
      var nothing
      var raw
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

        api.errorData(errors, function test(error, res, json) {
          bad = error
          nothing = res
          raw = json

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
        expect(nothing).eql([])
      })

      it('should pass through exactly what it got back from the server', function() {
        expect(raw).eql(response)
      })
    })
  })

  describe('queryData', function() {
    it('requires queries to send', function() {
      expect(function() { api.queryData(null, function() {}) })
        .to.throw('must pass queries to send')
    })

    it('requires a callback', function() {
      expect(function() { api.queryData([], null) })
        .to.throw('callback is required')
    })

    describe('on the happy path', function() {
      var bad
      var nothing
      var raw


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

        api.queryData(queries, function test(error, res, json) {
          bad = error
          nothing = res
          raw = json

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
        expect(nothing).eql([])
      })

      it('should pass through exactly what it got back from the server', function() {
        expect(raw).eql(response)
      })
    })
  })

  describe('analyticsEvents', function() {
    it('requires errors to send', function() {
      expect(function() { api.analyticsEvents(null, function() {}) })
        .to.throw('must pass events to send')
    })

    it('requires a callback', function() {
      expect(function() { api.analyticsEvents([], null) })
        .to.throw('callback is required')
    })

    describe('on the happy path', function() {
      var bad
      var nothing
      var raw


      var response = {return_value: []}

      before(function(done) {
        api._agent.config.run_id = RUN_ID
        var shutdown = nock(URL)
          .post(helper.generateCollectorPath('analytic_event_data', RUN_ID))
          .reply(200, response)

        var errors = [
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

        api.analyticsEvents(errors, function test(error, res, json) {
          bad = error
          nothing = res
          raw = json

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
        expect(nothing).eql([])
      })

      it('should pass through exactly what it got back from the server', function() {
        expect(raw).eql(response)
      })
    })
  })

  describe('metricData', function() {
    it('requires metrics to send', function() {
      expect(function() { api.metricData(null, function() {}) })
        .to.throw('must pass metrics to send')
    })

    it('requires a callback', function() {
      expect(function() { api.metricData([], null) })
        .to.throw('callback is required')
    })

    describe('on the happy path', function() {
      var bad
      var nothing
      var raw


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

        api.metricData(metrics, function test(error, res, json) {
          bad = error
          nothing = res
          raw = json

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
        expect(nothing).eql([])
      })

      it('should pass through exactly what it got back from the server', function() {
        expect(raw).eql(response)
      })
    })
  })

  describe('transactionSampleData', function() {
    it('requires slow trace data to send', function() {
      expect(function() { api.transactionSampleData(null, function() {}) })
        .to.throw('must pass slow trace data to send')
    })

    it('requires a callback', function() {
      expect(function() { api.transactionSampleData([], null) })
        .to.throw('callback is required')
    })

    describe('on the happy path', function() {
      var bad
      var nothing
      var raw


      var response = {return_value: []}

      before(function(done) {
        api._agent.config.run_id = RUN_ID
        var shutdown = nock(URL)
          .post(helper.generateCollectorPath('transaction_sample_data', RUN_ID))
          .reply(200, response)

        // imagine this is a serialized transaction trace
        var trace = []

        api.transactionSampleData([trace], function test(error, res, json) {
          bad = error
          nothing = res
          raw = json

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
        expect(nothing).eql([])
      })

      it('should pass through exactly what it got back from the server', function() {
        expect(raw).eql(response)
      })
    })
  })

  describe('shutdown', function() {
    it('requires a callback', function() {
      expect(function() { api.shutdown(null) }).to.throw('callback is required')
    })

    describe('on the happy path', function() {
      var bad = null
      var nothing = null
      var raw = null

      var response = {return_value: null}

      before(function(done) {
        api._agent.config.run_id = RUN_ID
        var shutdown = nock(URL)
          .post(helper.generateCollectorPath('shutdown', RUN_ID))
          .reply(200, response)

        api.shutdown(function test(error, res, json) {
          bad = error
          nothing = res
          raw = json

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
        expect(nothing).equal(null)
      })

      it('should pass through exactly what it got back from the server', function() {
        expect(raw).eql(response)
      })
    })

    describe('off the happy path', function() {
      describe('fails on a 503 status code', function() {
        var captured = null
        var body = null

        beforeEach(function(done) {
          api._agent.config.run_id = RUN_ID
          var failure = nock(URL)
            .post(helper.generateCollectorPath('shutdown', RUN_ID))
            .reply(503)

          api.shutdown(function test(error, response) {
            captured = error
            body = response

            failure.done()
            done()
          })
        })

        afterEach(function() {
          api._agent.config.run_id = undefined
        })

        it('should have gotten an error', function() {
          should.exist(captured)
        })

        it('should have passed on the status code', function() {
          expect(captured.statusCode).equal(503)
        })

        it('should have included an informative error message', function() {
          expect(captured.message)
            .equal('No body found in response to shutdown.')
        })

        it('should not have a response body', function() {
          should.not.exist(body)
        })
      })
    })
  })

  describe('_runLifecycle', function() {
    var method

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

    it('should discard InternalLimitExceeded exceptions', function(done) {
      var exception = {
        exception: {
          message: 'Trace memory limit exceeded: 32MB -- discarding trace for 1337',
          error_type: 'NewRelic::Agent::InternalLimitExceeded'
        }
      }

      var failure = nock(URL)
        .post(helper.generateCollectorPath('metric_data', 31337))
        .reply(200, exception)
      function tested(error) {
        should.not.exist(error)

        failure.done()
        done()
      }

      api._runLifecycle(method, null, tested)
    })

    it('should pass through HTTP 500 errors', function(done) {
      var failure = nock(URL)
        .post(helper.generateCollectorPath('metric_data', 31337))
        .reply(500)
      function tested(error) {
        expect(error.message).equal('No body found in response to metric_data.')

        failure.done()
        done()
      }

      api._runLifecycle(method, null, tested)
    })

    it('should pass through HTTP 503 errors', function(done) {
      var failure = nock(URL)
        .post(helper.generateCollectorPath('metric_data', 31337))
        .reply(503)
      function tested(error) {
        expect(error.message).equal('No body found in response to metric_data.')

        failure.done()
        done()
      }

      api._runLifecycle(method, null, tested)
    })

    it('should pass through InvalidLicenseKey errors', function(done) {
      var exception = {
        exception: {
          message: 'Your license key is invalid or the collector is busted.',
          error_type: 'NewRelic::Agent::LicenseException'
        }
      }

      var failure = nock(URL)
        .post(helper.generateCollectorPath('metric_data', 31337))
        .reply(200, exception)
      function tested(error) {
        expect(error.message)
          .equal('Your license key is invalid or the collector is busted.')

        failure.done()
        done()
      }

      api._runLifecycle(method, null, tested)
    })

    describe('on ForceRestartException', function() {
      var restart = null
      var shutdown = null
      var redirect = null
      var connect = null
      var succeed = null

      beforeEach(function() {
        var exception = {
          exception: {
            message: 'Yo, break off a piece of that Irish Sprang!',
            error_type: 'NewRelic::Agent::ForceRestartException'
          }
        }

        restart = nock(URL)
          .post(helper.generateCollectorPath('metric_data', 31337))
          .reply(200, exception)
        shutdown = nock(URL)
          .post(helper.generateCollectorPath('shutdown', 31337))
          .reply(200, {return_value: null})
        redirect = nock(URL)
          .post(helper.generateCollectorPath('preconnect'))
          .reply(200, {return_value: {redirect_host: HOST, security_policies: {}}})
        connect = nock(URL)
          .post(helper.generateCollectorPath('connect'))
          .reply(200, {return_value: {agent_run_id: 31338}})
        succeed = nock(URL)
          .post(helper.generateCollectorPath('metric_data', 31338))
          .reply(200, {return_value: {}})
      })

      function nockDone() {
        restart.done()
        shutdown.done()
        redirect.done()
        connect.done()
        succeed.done()
      }

      it('should reconnect and resubmit', function(done) {
        api._runLifecycle(method, null, function(error) {
          if (error) {
            console.error(error.stack) // eslint-disable-line no-console
          }
          expect(error).to.not.exist
          expect(api._agent.config.run_id).equal(31338) // has new run ID
          nockDone()
          done()
        })
      })

      it('should reconfigure the agent', function(done) {
        var reconfigureCalled = false
        var oldReconfigure = agent.reconfigure
        agent.reconfigure = function() {
          reconfigureCalled = true
          return oldReconfigure.apply(this, arguments)
        }

        api._runLifecycle(method, null, function(err) {
          expect(err).to.not.exist
          expect(reconfigureCalled).to.be.true
          nockDone()
          done()
        })
      })
    })

    it('should stop the agent on ForceDisconnectException', function(done) {
      var exception = {
        exception: {
          message: 'Wake up! Time to die!',
          error_type: 'NewRelic::Agent::ForceDisconnectException'
        }
      }

      var restart = nock(URL)
        .post(helper.generateCollectorPath('metric_data', 31337))
        .reply(200, exception)
      var shutdown = nock(URL)
        .post(helper.generateCollectorPath('shutdown', 31337))
        .reply(200, {return_value: null})

      function tested(error) {
        expect(error.message).equal('Wake up! Time to die!')
        expect(error.class).equal('NewRelic::Agent::ForceDisconnectException')
        should.not.exist(api._agent.config.run_id)

        restart.done()
        shutdown.done()
        done()
      }

      api._runLifecycle(method, null, tested)
    })

    it('should pass through maintenance notices', function(done) {
      var exception = {
        exception: {
          message: 'Out for a smoke beeearrrbeee',
          error_type: 'NewRelic::Agent::MaintenanceError'
        }
      }

      var failure = nock(URL)
        .post(helper.generateCollectorPath('metric_data', 31337))
        .reply(200, exception)
      function tested(error) {
        expect(error.message).equal('Out for a smoke beeearrrbeee')
        expect(error.class).equal('NewRelic::Agent::MaintenanceError')

        failure.done()
        done()
      }

      api._runLifecycle(method, null, tested)
    })

    it('should pass through runtime errors', function(done) {
      var exception = {
        exception: {
          message: 'What does this button do?',
          error_type: 'RuntimeError'
        }
      }

      var failure = nock(URL)
        .post(helper.generateCollectorPath('metric_data', 31337))
        .reply(200, exception)
      function tested(error) {
        expect(error.message).equal('What does this button do?')
        expect(error.class).equal('RuntimeError')

        failure.done()
        done()
      }

      api._runLifecycle(method, null, tested)
    })

    it('should pass through unexpected errors', function(done) {
      var failure = nock(URL)
        .post(helper.generateCollectorPath('metric_data', 31337))
        .reply(501)
      function tested(error) {
        expect(error.message).equal('No body found in response to metric_data.')

        failure.done()
        done()
      }

      api._runLifecycle(method, null, tested)
    })
  })
})
