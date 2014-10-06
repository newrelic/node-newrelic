'use strict'

var path   = require('path')
  , nock   = require('nock')
  , chai   = require('chai')
  , expect = chai.expect
  , should = chai.should()
  , API    = require('../../../lib/collector/api.js')
  

var HOST   = 'collector.newrelic.com'
  , PORT   = 80
  , URL    = 'http://' + HOST
  , RUN_ID = 1337
  

function generate(method, runID) {
  var fragment = '/agent_listener/invoke_raw_method?' +
    'marshal_format=json&protocol_version=12&' +
    'license_key=license%20key%20here&method=' + method

  if (runID) fragment += '&run_id=' + runID

  return fragment
}

var timeout = global.setTimeout
function fast() { global.setTimeout = process.nextTick; }
function slow() { global.setTimeout = timeout; }

describe("CollectorAPI", function () {
  var api

  before(function () {
    nock.disableNetConnect()

    var agentProperties = {
      reconfigure : function () {},
      state       : function () {},
      config      : {
        host         : HOST,
        port         : PORT,
        license_key  : 'license key here',
        applications : function () {
          return ['TEST']
        },
        publicSettings : function () {
          return {setting1: true, setting2: false}
        },
        browser_monitoring: {},
        transaction_tracer: {},
      }
    }

    api = new API(agentProperties)
  })

  after(function () {
    nock.enableNetConnect()
  })

  describe("_login", function () {
    describe("on the happy path", function () {
      var bad
        , ssc
        , raw
        

      var valid = {
        capture_params : true,
        agent_run_id   : RUN_ID
      }

      var response = {return_value : valid}

      before(function (done) {
        var redirection = nock(URL)
                            .post(generate('get_redirect_host'))
                            .reply(200, {return_value : HOST})
        var connection = nock(URL)
                            .post(generate('connect'))
                            .reply(200, response)

        api._login(function test(error, response, json) {
          bad = error
          ssc = response
          raw = json

          redirection.done()
          connection.done()
          done()
        })
      })

      it("should not error out", function () {
        should.not.exist(bad)
      })

      it("should have a run ID", function () {
        expect(ssc.agent_run_id).equal(RUN_ID)
      })

      it("should pass through server-side configuration untouched", function () {
        expect(ssc).eql(valid)
      })

      it("should pass through exactly what it got back from the server", function () {
        expect(raw).eql(response)
      })
    })

    describe("off the happy path", function () {
      describe("receiving 503 response from get_redirect_host", function () {
        var captured

        before(function (done) {
          var redirection = nock(URL).post(generate('get_redirect_host')).reply(503)

          api._login(function test(error) {
            captured = error

            redirection.done()
            done()
          })
        })

        it("should have gotten an error", function () {
          should.exist(captured)
        })

        it("should have passed on the status code", function () {
          expect(captured.statusCode).equal(503)
        })

        it("should have included an informative error message", function () {
          expect(captured.message)
            .equal("No body found in response to get_redirect_host.")
        })
      })

      describe("receiving no hostname from get_redirect_host", function () {
        var captured
          , ssc
          

        before(function (done) {
          var redirection = nock(URL)
                              .post(generate('get_redirect_host'))
                              .reply(200, {return_value : ''})
          var connect = nock(URL)
                          .post(generate('connect'))
                          .reply(200, {return_value : {agent_run_id : RUN_ID}})

          api._login(function test(error, config) {
            captured = error
            ssc = config

            redirection.done()
            connect.done()
            done()
          })
        })

        it("should have gotten no error", function () {
          should.not.exist(captured)
        })

        it("should use preexisting collector hostname", function () {
          expect(api._agent.config.host).equal(HOST)
        })

        it("should pass along server-side configuration from collector", function () {
          expect(ssc).eql({agent_run_id : RUN_ID})
        })
      })

      describe("receiving a weirdo redirect name from get_redirect_host", function () {
        var captured
          , ssc
          

        before(function (done) {
          var redirection = nock(URL)
                              .post(generate('get_redirect_host'))
                              .reply(200, {return_value : HOST + ':chug:8080'})
          var connect = nock(URL)
                          .post(generate('connect'))
                          .reply(200, {return_value : {agent_run_id : RUN_ID}})

          api._login(function test(error, config) {
            captured = error
            ssc = config

            redirection.done()
            connect.done()
            done()
          })
        })

        it("should have gotten no error", function () {
          should.not.exist(captured)
        })

        it("should use preexisting collector hostname", function () {
          expect(api._agent.config.host).equal(HOST)
        })

        it("should use preexisting collector port number", function () {
          expect(api._agent.config.port).equal(PORT)
        })

        it("should pass along server-side configuration from collector", function () {
          expect(ssc).eql({agent_run_id : RUN_ID})
        })
      })

      describe("receiving no config back from connect", function () {
        var captured
          , ssc
          

        before(function (done) {
          var redirection = nock(URL)
                              .post(generate('get_redirect_host'))
                              .reply(200, {return_value : HOST})
          var connect = nock(URL)
                          .post(generate('connect'))
                          .reply(200, {return_value : null})

          api._login(function test(error, config) {
            captured = error
            ssc = config

            redirection.done()
            connect.done()
            done()
          })
        })

        it("should have gotten an error", function () {
          should.exist(captured)
        })

        it("should have gotten an informative error message", function () {
          expect(captured.message).equal("No agent run ID received from handshake.")
        })

        it("should pass along no server-side configuration from collector", function () {
          should.not.exist(ssc)
        })
      })

      describe("receiving 503 response from connect", function () {
        var captured

        before(function (done) {
          var redirection = nock(URL)
                              .post(generate('get_redirect_host'))
                              .reply(200, {return_value : HOST})
          var connection = nock(URL)
                              .post(generate('connect'))
                              .reply(503)

          api._login(function test(error) {
            captured = error

            redirection.done()
            connection.done()
            done()
          })
        })

        it("should have gotten an error", function () {
          should.exist(captured)
        })

        it("should have passed on the status code", function () {
          expect(captured.statusCode).equal(503)
        })

        it("should have included an informative error message", function () {
          expect(captured.message)
            .equal("No body found in response to connect.")
        })
      })

      describe("receiving 200 response to get_redirect_host but no data", function () {
        var captured
          , data
          , raw
          

        before(function (done) {
          var redirection = nock(URL).post(generate('get_redirect_host')).reply(200)

          api._login(function test(error, response, json) {
            captured = error
            data     = response
            raw      = json

            redirection.done()
            done()
          })
        })

        it("should have gotten an error", function () {
          should.exist(captured)
        })

        it("should have paseed on the status code", function () {
          expect(captured.statusCode).equal(200)
        })

        it("should have included an informative error message", function () {
          expect(captured.message)
            .equal("No body found in response to get_redirect_host.")
        })

        it("should have no return_value", function () {
          should.not.exist(data)
        })

        it("should have passed along (empty) body", function () {
          should.not.exist(raw)
        })
      })

      describe("receiving 200 response to connect but no data", function () {
        var captured
          , data
          , raw
          

        before(function (done) {
          var redirection = nock(URL)
                              .post(generate('get_redirect_host'))
                              .reply(200, {return_value : HOST})
          var connection  = nock(URL).post(generate('connect')).reply(200)

          api._login(function test(error, response, json) {
            captured = error
            data     = response
            raw      = json

            redirection.done()
            connection.done()
            done()
          })
        })

        it("should have gotten an error", function () {
          should.exist(captured)
        })

        it("should not have a status code on the error", function () {
          expect(captured.statusCode).equal(200)
        })

        it("should have included an informative error message", function () {
          expect(captured.message).equal("No body found in response to connect.")
        })

        it("should have no return_value", function () {
          should.not.exist(data)
        })

        it("should have passed along (empty) body", function () {
          should.not.exist(raw)
        })
      })

      describe("receiving InvalidLicenseKey after get_redirect_host", function () {
        var captured
          , data
          , raw
          

        var response = {
          exception : {
            message    : 'Invalid license key. Please contact support@newrelic.com.',
            error_type : 'NewRelic::Agent::LicenseException'
          }
        }

        before(function (done) {
          var redirection = nock(URL)
                              .post(generate('get_redirect_host'))
                              .reply(200, response)

          api._login(function test(error, response, json) {
            captured = error
            data     = response
            raw      = json

            redirection.done()
            done()
          })
        })

        it("should have gotten an error", function () {
          should.exist(captured)
        })

        it("should have a status code on the error", function () {
          expect(captured.statusCode).equal(200)
        })

        it("should have included an informative error message", function () {
          expect(captured.message)
            .equal("Invalid license key. Please contact support@newrelic.com.")
        })

        it("should have included the New Relic error class", function () {
          expect(captured.class).equal("NewRelic::Agent::LicenseException")
        })

        it("should have no return value", function () {
          should.not.exist(data)
        })

        it("should have passed along raw response", function () {
          expect(raw).eql(response)
        })
      })
    })
  })

  describe("connect", function () {
    it("requires a callback", function () {
      expect(function () { api.connect(null); }).throws("callback is required")
    })

    describe("on the happy path", function () {
      describe("succeeds immediately, the same as _login", function () {
        var bad
          , ssc
          , raw
          

        var valid = {
          capture_params : true,
          agent_run_id   : RUN_ID
        }

        var response = {return_value : valid}

        before(function (done) {
          var redirection = nock(URL)
                              .post(generate('get_redirect_host'))
                              .reply(200, {return_value : HOST})
          var connection = nock(URL)
                              .post(generate('connect'))
                              .reply(200, response)

          api.connect(function test(error, response, json) {
            bad = error
            ssc = response
            raw = json

            redirection.done()
            connection.done()
            done()
          })
        })

        it("should not error out", function () {
          should.not.exist(bad)
        })

        it("should have a run ID", function () {
          expect(ssc.agent_run_id).equal(RUN_ID)
        })

        it("should pass through server-side configuration untouched", function () {
          expect(ssc).eql(valid)
        })

        it("should pass through exactly what it got back from the server", function () {
          expect(raw).eql(response)
        })
      })

      describe("succeeds when given a non-80 port number for redirect", function () {
        var bad
          , ssc
          , raw
          

        var valid = {
          capture_params : true,
          agent_run_id   : RUN_ID
        }

        var response = {return_value : valid}

        before(function (done) {
          var redirection = nock(URL)
                              .post(generate('get_redirect_host'))
                              .reply(200, {return_value : HOST + ':8080'})
          var connection = nock(URL + ':8080')
                              .post(generate('connect'))
                              .reply(200, response)

          api.connect(function test(error, response, json) {
            bad = error
            ssc = response
            raw = json

            redirection.done()
            connection.done()
            done()
          })
        })

        // the port number gets changed, so reset it
        after(function () {
          api._agent.config.port = 80
        })

        it("should not error out", function () {
          should.not.exist(bad)
        })

        it("should have the correct hostname", function () {
          expect(api._agent.config.host).equal(HOST)
        })

        it("should have the correct port number", function () {
          expect(api._agent.config.port).equal('8080')
        })

        it("should have a run ID", function () {
          expect(ssc.agent_run_id).equal(RUN_ID)
        })

        it("should pass through server-side configuration untouched", function () {
          expect(ssc).eql(valid)
        })

        it("should pass through exactly what it got back from the server", function () {
          expect(raw).eql(response)
        })
      })

      describe("succeeds after one 503 on get_redirect_host", function () {
        var bad
          , ssc
          , raw
          

        var valid = {
          capture_params : true,
          agent_run_id   : RUN_ID
        }

        var response = {return_value : valid}

        before(function (done) {
          fast()

          var redirectURL = generate('get_redirect_host')
            , failure     = nock(URL).post(redirectURL).reply(503)
            , success     = nock(URL).post(redirectURL).reply(200, {return_value : HOST})
            , connection  = nock(URL).post(generate('connect')).reply(200, response)
            

          api.connect(function test(error, response, json) {
            bad = error
            ssc = response
            raw = json

            failure.done()
            success.done()
            connection.done()
            done()
          })
        })

        after(function () {
          slow()
        })

        it("should not error out", function () {
          should.not.exist(bad)
        })

        it("should have a run ID", function () {
          expect(ssc.agent_run_id).equal(RUN_ID)
        })

        it("should pass through server-side configuration untouched", function () {
          expect(ssc).eql(valid)
        })

        it("should pass through exactly what it got back from the server", function () {
          expect(raw).eql(response)
        })
      })

      describe("succeeds after five 503s on get_redirect_host", function () {
        var bad
          , ssc
          , raw
          

        var valid = {
          capture_params : true,
          agent_run_id   : RUN_ID
        }

        var response = {return_value : valid}

        before(function (done) {
          fast()

          var redirectURL = generate('get_redirect_host')
            , failure     = nock(URL).post(redirectURL).times(5).reply(503)
            , success     = nock(URL).post(redirectURL).reply(200, {return_value : HOST})
            , connection  = nock(URL).post(generate('connect')).reply(200, response)
            

          api.connect(function test(error, response, json) {
            bad = error
            ssc = response
            raw = json

            failure.done()
            success.done()
            connection.done()
            done()
          })
        })

        after(function () {
          slow()
        })

        it("should not error out", function () {
          should.not.exist(bad)
        })

        it("should have a run ID", function () {
          expect(ssc.agent_run_id).equal(RUN_ID)
        })

        it("should pass through server-side configuration untouched", function () {
          expect(ssc).eql(valid)
        })

        it("should pass through exactly what it got back from the server", function () {
          expect(raw).eql(response)
        })
      })
    })

    describe("off the happy path", function () {
      describe("fails after six 503s on get_redirect_host", function () {
        var captured
          , body
          , raw
          

        before(function (done) {
          fast()

          var redirectURL = generate('get_redirect_host')
            , failure     = nock(URL).post(redirectURL).times(6).reply(503)
            

          api.connect(function test(error, response, json) {
            captured = error
            body     = response
            raw      = json

            failure.done()
            done()
          })
        })

        after(function () {
          slow()
        })

        it("should have gotten an error", function () {
          should.exist(captured)
        })

        it("should have passed on the status code", function () {
          expect(captured.statusCode).equal(503)
        })

        it("should have included an informative error message", function () {
          expect(captured.message)
            .equal("No body found in response to get_redirect_host.")
        })

        it("should not have a response body", function () {
          should.not.exist(body)
        })
      })

      describe("fails on receiving InvalidLicenseKey", function () {
        var captured
          , data
          , raw
          

        var response = {
          exception : {
            message    : 'Invalid license key. Please contact support@newrelic.com.',
            error_type : 'NewRelic::Agent::LicenseException'
          }
        }

        before(function (done) {
          fast()
          var redirectURL = generate('get_redirect_host')
            , failure     = nock(URL).post(redirectURL).times(6).reply(200, response)
            

          api.connect(function test(error, response, json) {
            captured = error
            data     = response
            raw      = json

            failure.done()
            done()
          })
        })

        after(function () {
          slow()
        })

        it("should have gotten an error", function () {
          should.exist(captured)
        })

        it("should have a status code on the error", function () {
          expect(captured.statusCode).equal(200)
        })

        it("should have included an informative error message", function () {
          expect(captured.message)
            .equal("Invalid license key. Please contact support@newrelic.com.")
        })

        it("should have included the New Relic error class", function () {
          expect(captured.class).equal("NewRelic::Agent::LicenseException")
        })

        it("should have no return value", function () {
          should.not.exist(data)
        })

        it("should have passed along raw response", function () {
          expect(raw).eql(response)
        })
      })

      describe("fails on receiving InvalidLicenseKey after one 503", function () {
        var captured
          , data
          , raw
          

        var response = {
          exception : {
            message    : 'Invalid license key. Please contact support@newrelic.com.',
            error_type : 'NewRelic::Agent::LicenseException'
          }
        }

        before(function (done) {
          fast()

          var redirectURL = generate('get_redirect_host')
            , failure     = nock(URL).post(redirectURL).reply(503)
            , license     = nock(URL).post(redirectURL).times(5).reply(200, response)
            

          api.connect(function test(error, response, json) {
            captured = error
            data     = response
            raw      = json

            failure.done()
            license.done()
            done()
          })
        })

        after(function () {
          slow()
        })

        it("should have gotten an error", function () {
          should.exist(captured)
        })

        it("should have a status code on the error", function () {
          expect(captured.statusCode).equal(200)
        })

        it("should have included an informative error message", function () {
          expect(captured.message)
            .equal("Invalid license key. Please contact support@newrelic.com.")
        })

        it("should have included the New Relic error class", function () {
          expect(captured.class).equal("NewRelic::Agent::LicenseException")
        })

        it("should have no return value", function () {
          should.not.exist(data)
        })

        it("should have passed along raw response", function () {
          expect(raw).eql(response)
        })
      })
    })
  })

  describe("reportSettings", function () {
    var bad
      , raw
      , response = {return_value: []}

    before(function (done) {
      api._agent.config.run_id = RUN_ID

      var mock = nock(URL)
                   .post(generate('agent_settings', RUN_ID))
                   .reply(200, response)

      api.reportSettings(function test(error, json) {
        bad = error
        raw = json
        mock.done()
        done()
      })
    })

    after(function () {
      api._agent.config.run_id = undefined
    })

    it("should not error out", function () {
      should.not.exist(bad)
    })

    it("should return the expected 'empty' response", function () {
      expect(raw).eql(response)
    })
  })

  describe("errorData", function () {
    it("requires errors to send", function () {
      expect(function () { api.errorData(null, function () {}); })
        .throws("must pass errors to send")
    })

    it("requires a callback", function () {
      expect(function () { api.errorData([], null); })
        .throws("callback is required")
    })

    describe("on the happy path", function () {
      var bad
        , nothing
        , raw
        

      var response = {return_value : []}

      before(function (done) {
        api._agent.config.run_id = RUN_ID
        var shutdown = nock(URL)
                         .post(generate('error_data', RUN_ID))
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

        api.errorData(errors, function test(error, response, json) {
          bad = error
          nothing = response
          raw = json

          shutdown.done()
          done()
        })
      })

      after(function () {
        api._agent.config.run_id = undefined
      })

      it("should not error out", function () {
        should.not.exist(bad)
      })

      it("should return empty data array", function () {
        expect(nothing).eql([])
      })

      it("should pass through exactly what it got back from the server", function () {
        expect(raw).eql(response)
      })
    })
  })

  describe("analyticsEvents", function () {
    it("requires errors to send", function () {
      expect(function () { api.analyticsEvents(null, function () {}); })
        .throws("must pass events to send")
    })

    it("requires a callback", function () {
      expect(function () { api.analyticsEvents([], null); })
        .throws("callback is required")
    })

    describe("on the happy path", function () {
      var bad
        , nothing
        , raw
        

      var response = {return_value : []}

      before(function (done) {
        api._agent.config.run_id = RUN_ID
        var shutdown = nock(URL)
                         .post(generate('analytic_event_data', RUN_ID))
                         .reply(200, response)

        var errors = [
          RUN_ID,
          [{
            "webDuration" : 1.0,
            "timestamp"   : 1000,
            "name"        : "Controller/rails/welcome/index",
            "duration"    : 1.0,
            "type"        : "Transaction"
          },{
            "A": "a",
            "B": "b",
          }]
        ]

        api.analyticsEvents(errors, function test(error, response, json) {
          bad = error
          nothing = response
          raw = json

          shutdown.done()
          done()
        })
      })

      after(function () {
        api._agent.config.run_id = undefined
      })

      it("should not error out", function () {
        should.not.exist(bad)
      })

      it("should return empty data array", function () {
        expect(nothing).eql([])
      })

      it("should pass through exactly what it got back from the server", function () {
        expect(raw).eql(response)
      })
    })
  })

  describe("metricData", function () {
    it("requires metrics to send", function () {
      expect(function () { api.metricData(null, function () {}); })
        .throws("must pass metrics to send")
    })

    it("requires a callback", function () {
      expect(function () { api.metricData([], null); })
        .throws("callback is required")
    })

    describe("on the happy path", function () {
      var bad
        , nothing
        , raw
        

      var response = {return_value : []}

      before(function (done) {
        api._agent.config.run_id = RUN_ID
        var shutdown = nock(URL)
                         .post(generate('metric_data', RUN_ID))
                         .reply(200, response)

        // would like to keep this set of tests relatively self-contained
        var metrics = {
          toJSON : function () {
            return [
              [{name : "Test/Parent"},  [1,0.026,0.006,0.026,0.026,0.000676]],
              [{name : "Test/Child/1"}, [1,0.012,0.012,0.012,0.012,0.000144]],
              [{name : "Test/Child/2"}, [1,0.008,0.008,0.008,0.008,0.000064]]
            ]
          }
        }

        api.metricData(metrics, function test(error, response, json) {
          bad = error
          nothing = response
          raw = json

          shutdown.done()
          done()
        })
      })

      after(function () {
        api._agent.config.run_id = undefined
      })

      it("should not error out", function () {
        should.not.exist(bad)
      })

      it("should return empty data array", function () {
        expect(nothing).eql([])
      })

      it("should pass through exactly what it got back from the server", function () {
        expect(raw).eql(response)
      })
    })
  })

  describe("transactionSampleData", function () {
    it("requires slow trace data to send", function () {
      expect(function () { api.transactionSampleData(null, function () {}); })
        .throws("must pass slow trace data to send")
    })

    it("requires a callback", function () {
      expect(function () { api.transactionSampleData([], null); })
        .throws("callback is required")
    })

    describe("on the happy path", function () {
      var bad
        , nothing
        , raw
        

      var response = {return_value : []}

      before(function (done) {
        api._agent.config.run_id = RUN_ID
        var shutdown = nock(URL)
                         .post(generate('transaction_sample_data', RUN_ID))
                         .reply(200, response)

        // imagine this is a serialized transaction trace
        var trace = []

        api.transactionSampleData([trace], function test(error, response, json) {
          bad = error
          nothing = response
          raw = json

          shutdown.done()
          done()
        })
      })

      after(function () {
        api._agent.config.run_id = undefined
      })

      it("should not error out", function () {
        should.not.exist(bad)
      })

      it("should return empty data array", function () {
        expect(nothing).eql([])
      })

      it("should pass through exactly what it got back from the server", function () {
        expect(raw).eql(response)
      })
    })
  })

  describe("sqlTraceData", function () {
    it("requires slow SQL data to send", function () {
      expect(function () { api.sqlTraceData(null, function () {}); })
        .throws("must pass slow SQL to send")
    })

    it("requires a callback", function () {
      expect(function () { api.sqlTraceData([], null); })
        .throws("callback is required")
    })

    describe("on the happy path", function () {
      var bad
        , nothing
        , raw
        

      var response = {return_value : []}

      before(function (done) {
        api._agent.config.run_id = RUN_ID
        var shutdown = nock(URL)
                         .post(generate('sql_trace_data', RUN_ID))
                         .reply(200, response)

        // Node doesn't even support SQL traces yet, but it was easy to implement
        var trace = []

        api.sqlTraceData([trace], function test(error, response, json) {
          bad = error
          nothing = response
          raw = json

          shutdown.done()
          done()
        })
      })

      after(function () {
        api._agent.config.run_id = undefined
      })

      it("should not error out", function () {
        should.not.exist(bad)
      })

      it("should return empty data array", function () {
        expect(nothing).eql([])
      })

      it("should pass through exactly what it got back from the server", function () {
        expect(raw).eql(response)
      })
    })
  })

  describe("shutdown", function () {
    it("requires a callback", function () {
      expect(function () { api.shutdown(null); }).throws("callback is required")
    })

    describe("on the happy path", function () {
      var bad
        , nothing
        , raw
        

      var response = {return_value : null}

      before(function (done) {
        api._agent.config.run_id = RUN_ID
        var shutdown = nock(URL).post(generate('shutdown', RUN_ID)).reply(200, response)

        api.shutdown(function test(error, response, json) {
          bad = error
          nothing = response
          raw = json

          shutdown.done()
          done()
        })
      })

      after(function () {
        api._agent.config.run_id = undefined
      })

      it("should not error out", function () {
        should.not.exist(bad)
      })

      it("should return null", function () {
        expect(nothing).equal(null)
      })

      it("should pass through exactly what it got back from the server", function () {
        expect(raw).eql(response)
      })
    })

    describe("off the happy path", function () {
      describe("fails on a 503 status code", function () {
        var captured
          , body
          , raw
          

        before(function (done) {
          api._agent.config.run_id = RUN_ID
          var failure = nock(URL).post(generate('shutdown', RUN_ID)).reply(503)

          api.shutdown(function test(error, response, json) {
            captured = error
            body     = response
            raw      = json

            failure.done()
            done()
          })
        })

        after(function () {
          api._agent.config.run_id = undefined
        })

        it("should have gotten an error", function () {
          should.exist(captured)
        })

        it("should have passed on the status code", function () {
          expect(captured.statusCode).equal(503)
        })

        it("should have included an informative error message", function () {
          expect(captured.message)
            .equal("No body found in response to shutdown.")
        })

        it("should not have a response body", function () {
          should.not.exist(body)
        })
      })
    })
  })

  describe("_runLifecycle", function () {
    var method

    beforeEach(function () {
      var config = {
        host         : HOST,
        port         : PORT,
        license_key  : 'license key here',
        run_id       : 31337,
        applications : function () {
          return ['TEST']
        },
        browser_monitoring: {},
        transaction_tracer: {},
        publicSettings : function () {
          return {setting1: true, setting2: false}
        },
      }
      var properties = {
        config      : config,
        reconfigure : function (ssc) { config.run_id = ssc.agent_run_id; },
        state       : function () {},
        stop        : function (callback) { api.shutdown(callback); }
      }

      api    = new API(properties)
      method = api._methods.metrics
    })

    it("should bail out if disconnected", function (done) {
      api._agent.config.run_id = undefined

      function tested(error) {
        should.exist(error)
        expect(error.message).equals("Not connected to collector.")

        done()
      }

      api._runLifecycle(method, null, tested)
    })

    it("should discard HTTP 413 errors", function (done) {
      var failure = nock(URL).post(generate('metric_data', 31337)).reply(413)
      function tested(error) {
        should.not.exist(error)

        failure.done()
        done()
      }

      api._runLifecycle(method, null, tested)
    })

    it("should discard HTTP 415 errors", function (done) {
      var failure = nock(URL).post(generate('metric_data', 31337)).reply(415)
      function tested(error) {
        should.not.exist(error)

        failure.done()
        done()
      }

      api._runLifecycle(method, null, tested)
    })

    it("should discard InternalLimitExceeded exceptions", function (done) {
      var exception = {
        exception : {
          message    : "Trace memory limit exceeded: 32MB -- discarding trace for 1337",
          error_type : 'NewRelic::Agent::InternalLimitExceeded'
        }
      }

      var failure = nock(URL).post(generate('metric_data', 31337)).reply(200, exception)
      function tested(error) {
        should.not.exist(error)

        failure.done()
        done()
      }

      api._runLifecycle(method, null, tested)
    })

    it("should pass through HTTP 500 errors", function (done) {
      var failure = nock(URL).post(generate('metric_data', 31337)).reply(500)
      function tested(error) {
        expect(error.message).equal("No body found in response to metric_data.")

        failure.done()
        done()
      }

      api._runLifecycle(method, null, tested)
    })

    it("should pass through HTTP 503 errors", function (done) {
      var failure = nock(URL).post(generate('metric_data', 31337)).reply(503)
      function tested(error) {
        expect(error.message).equal("No body found in response to metric_data.")

        failure.done()
        done()
      }

      api._runLifecycle(method, null, tested)
    })

    it("should pass through InvalidLicenseKey errors", function (done) {
      var exception = {
        exception : {
          message    : "Your license key is invalid or the collector is busted.",
          error_type : 'NewRelic::Agent::LicenseException'
        }
      }

      var failure = nock(URL).post(generate('metric_data', 31337)).reply(200, exception)
      function tested(error) {
        expect(error.message)
          .equal("Your license key is invalid or the collector is busted.")

        failure.done()
        done()
      }

      api._runLifecycle(method, null, tested)
    })

    it("should reconnect and resubmit on ForceRestartException", function (done) {
      var exception = {
        exception : {
          message    : "Yo, break off a piece of that Irish Sprang!",
          error_type : 'NewRelic::Agent::ForceRestartException'
        }
      }

      var restart  = nock(URL)
                       .post(generate('metric_data', 31337))
                       .reply(200, exception)
      var shutdown = nock(URL)
                       .post(generate('shutdown', 31337))
                       .reply(200, {return_value : null})
      var redirect = nock(URL)
                       .post(generate('get_redirect_host'))
                       .reply(200, {return_value : "collector.newrelic.com"})
      var connect = nock(URL)
                      .post(generate('connect'))
                      .reply(200, {return_value : {agent_run_id : 31338}})
      var succeed = nock(URL)
                      .post(generate('metric_data', 31338))
                      .reply(200, {return_value : {}})

      function tested(error) {
        should.not.exist(error)
        expect(api._agent.config.run_id).equal(31338); // has new run ID

        restart.done()
        shutdown.done()
        redirect.done()
        connect.done()
        succeed.done()
        done()
      }

      api._runLifecycle(method, null, tested)
    })

    it("should stop the agent on ForceDisconnectException", function (done) {
      var exception = {
        exception : {
          message    : "Wake up! Time to die!",
          error_type : 'NewRelic::Agent::ForceDisconnectException'
        }
      }

      var restart  = nock(URL)
                       .post(generate('metric_data', 31337))
                       .reply(200, exception)
      var shutdown = nock(URL)
                       .post(generate('shutdown', 31337))
                       .reply(200, {return_value : null})

      function tested(error) {
        expect(error.message).equal("Wake up! Time to die!")
        expect(error.class).equal('NewRelic::Agent::ForceDisconnectException')
        should.not.exist(api._agent.config.run_id)

        restart.done()
        shutdown.done()
        done()
      }

      api._runLifecycle(method, null, tested)
    })

    it("should pass through maintenance notices", function (done) {
      var exception = {
        exception : {
          message    : "Out for a smoke beeearrrbeee",
          error_type : 'NewRelic::Agent::MaintenanceError'
        }
      }

      var failure = nock(URL).post(generate('metric_data', 31337)).reply(200, exception)
      function tested(error) {
        expect(error.message).equal("Out for a smoke beeearrrbeee")
        expect(error.class).equal('NewRelic::Agent::MaintenanceError')

        failure.done()
        done()
      }

      api._runLifecycle(method, null, tested)
    })

    it("should pass through runtime errors", function (done) {
      var exception = {
        exception : {
          message    : "What does this button do?",
          error_type : 'RuntimeError'
        }
      }

      var failure = nock(URL).post(generate('metric_data', 31337)).reply(200, exception)
      function tested(error) {
        expect(error.message).equal("What does this button do?")
        expect(error.class).equal('RuntimeError')

        failure.done()
        done()
      }

      api._runLifecycle(method, null, tested)
    })

    it("should pass through unexpected errors", function (done) {
      var failure = nock(URL).post(generate('metric_data', 31337)).reply(501)
      function tested(error) {
        expect(error.message).equal("No body found in response to metric_data.")

        failure.done()
        done()
      }

      api._runLifecycle(method, null, tested)
    })
  })

})
