'use strict';

var path   = require('path')
  , nock   = require('nock')
  , chai   = require('chai')
  , expect = chai.expect
  , should = chai.should()
  , API    = require(path.join(__dirname, '..', 'lib', 'collector', 'api.js'))
  ;

var HOST = 'collector.newrelic.com'
  , PORT = 80
  , URL  = 'http://' + HOST
  ;

function generate(method, runID) {
  var fragment = '/agent_listener/invoke_raw_method?' +
    'marshal_format=json&protocol_version=12&' +
    'license_key=license%20key%20here&method=' + method;

  if (runID) fragment += '&run_id=' + runID;

  return fragment;
}

var timeout = global.setTimeout;
function fast() { global.setTimeout = process.nextTick; }
function slow() { global.setTimeout = timeout; }

describe("CollectorAPI", function () {
  var api;

  before(function () {
    nock.disableNetConnect();

    var agentProperties = {
      config : {
        host         : HOST,
        port         : PORT,
        license_key  : 'license key here',
        applications : function () {
          return ['TEST'];
        }
      }
    };

    api = new API(agentProperties);
  });

  after(function () {
    nock.enableNetConnect();
  });

  describe("_login", function () {
    describe("on the happy path", function () {
      var RUN_ID = 1337
        , bad
        , ssc
        , raw
        ;

      var valid = {
        capture_params : true,
        agent_run_id   : RUN_ID
      };

      var response = {return_value : valid};

      before(function (done) {
        var redirection = nock(URL)
                            .post(generate('get_redirect_host'))
                            .reply(200, {return_value : HOST});
        var connection = nock(URL)
                            .post(generate('connect'))
                            .reply(200, response);

        api._login(function test(error, response, json) {
          bad = error;
          ssc = response;
          raw = json;

          redirection.done();
          connection.done();
          done();
        });
      });

      it("should not error out", function () {
        should.not.exist(bad);
      });

      it("should have a run ID", function () {
        expect(ssc.agent_run_id).equal(RUN_ID);
      });

      it("should pass through server-side configuration untouched", function () {
        expect(ssc).eql(valid);
      });

      it("should pass through exactly what it got back from the server", function () {
        expect(raw).eql(response);
      });
    });

    describe("off the happy path", function () {
      describe("receiving 503 response from get_redirect_host", function () {
        var captured;

        before(function (done) {
          var redirection = nock(URL).post(generate('get_redirect_host')).reply(503);

          api._login(function test(error) {
            captured = error;

            redirection.done();
            done();
          });
        });

        it("should have gotten an error", function () {
          should.exist(captured);
        });

        it("should have passed on the status code", function () {
          expect(captured.statusCode).equal(503);
        });

        it("should have included an informative error message", function () {
          expect(captured.message)
            .equal("No body found in response to get_redirect_host.");
        });
      });

      describe("receiving 503 response from connect", function () {
        var captured;

        before(function (done) {
          var redirection = nock(URL)
                              .post(generate('get_redirect_host'))
                              .reply(200, {return_value : HOST});
          var connection = nock(URL)
                              .post(generate('connect'))
                              .reply(503);

          api._login(function test(error) {
            captured = error;

            redirection.done();
            connection.done();
            done();
          });
        });

        it("should have gotten an error", function () {
          should.exist(captured);
        });

        it("should have passed on the status code", function () {
          expect(captured.statusCode).equal(503);
        });

        it("should have included an informative error message", function () {
          expect(captured.message)
            .equal("No body found in response to connect.");
        });
      });

      describe("receiving 200 response to get_redirect_host but no data", function () {
        var captured
          , data
          , raw
          ;

        before(function (done) {
          var redirection = nock(URL).post(generate('get_redirect_host')).reply(200);

          api._login(function test(error, response, json) {
            captured = error;
            data     = response;
            raw      = json;

            redirection.done();
            done();
          });
        });

        it("should have gotten an error", function () {
          should.exist(captured);
        });

        it("should have paseed on the status code", function () {
          expect(captured.statusCode).equal(200);
        });

        it("should have included an informative error message", function () {
          expect(captured.message)
            .equal("No body found in response to get_redirect_host.");
        });

        it("should have no return_value", function () {
          should.not.exist(data);
        });

        it("should have passed along (empty) body", function () {
          should.not.exist(raw);
        });
      });

      describe("receiving 200 response to connect but no data", function () {
        var captured
          , data
          , raw
          ;

        before(function (done) {
          var redirection = nock(URL)
                              .post(generate('get_redirect_host'))
                              .reply(200, {return_value : HOST});
          var connection  = nock(URL).post(generate('connect')).reply(200);

          api._login(function test(error, response, json) {
            captured = error;
            data     = response;
            raw      = json;

            redirection.done();
            connection.done();
            done();
          });
        });

        it("should have gotten an error", function () {
          should.exist(captured);
        });

        it("should not have a status code on the error", function () {
          expect(captured.statusCode).equal(200);
        });

        it("should have included an informative error message", function () {
          expect(captured.message).equal("No body found in response to connect.");
        });

        it("should have no return_value", function () {
          should.not.exist(data);
        });

        it("should have passed along (empty) body", function () {
          should.not.exist(raw);
        });
      });

      describe("receiving InvalidLicenseKey after get_redirect_host", function () {
        var captured
          , data
          , raw
          ;

        var response = {
          exception : {
            message    : 'Invalid license key. Please contact support@newrelic.com.',
            error_type : 'NewRelic::Agent::LicenseException'
          }
        };

        before(function (done) {
          var redirection = nock(URL)
                              .post(generate('get_redirect_host'))
                              .reply(200, response);

          api._login(function test(error, response, json) {
            captured = error;
            data     = response;
            raw      = json;

            redirection.done();
            done();
          });
        });

        it("should have gotten an error", function () {
          should.exist(captured);
        });

        it("should have a status code on the error", function () {
          expect(captured.statusCode).equal(200);
        });

        it("should have included an informative error message", function () {
          expect(captured.message)
            .equal("Invalid license key. Please contact support@newrelic.com.");
        });

        it("should have included the New Relic error class", function () {
          expect(captured.class).equal("NewRelic::Agent::LicenseException");
        });

        it("should have no return value", function () {
          should.not.exist(data);
        });

        it("should have passed along raw response", function () {
          expect(raw).eql(response);
        });
      });
    });
  });

  describe("connect", function () {
    describe("on the happy path", function () {
      describe("succeeds immediately, the same as _login", function () {
        var RUN_ID = 1337
          , bad
          , ssc
          , raw
          ;

        var valid = {
          capture_params : true,
          agent_run_id   : RUN_ID
        };

        var response = {return_value : valid};

        before(function (done) {
          var redirection = nock(URL)
                              .post(generate('get_redirect_host'))
                              .reply(200, {return_value : HOST});
          var connection = nock(URL)
                              .post(generate('connect'))
                              .reply(200, response);

          api.connect(function test(error, response, json) {
            bad = error;
            ssc = response;
            raw = json;

            redirection.done();
            connection.done();
            done();
          });
        });

        it("should not error out", function () {
          should.not.exist(bad);
        });

        it("should have a run ID", function () {
          expect(ssc.agent_run_id).equal(RUN_ID);
        });

        it("should pass through server-side configuration untouched", function () {
          expect(ssc).eql(valid);
        });

        it("should pass through exactly what it got back from the server", function () {
          expect(raw).eql(response);
        });
      });

      describe("succeeds after one 503 on get_redirect_host", function () {
        var RUN_ID = 1337
          , bad
          , ssc
          , raw
          ;

        var valid = {
          capture_params : true,
          agent_run_id   : RUN_ID
        };

        var response = {return_value : valid};

        before(function (done) {
          fast();

          var redirectURL = generate('get_redirect_host')
            , failure     = nock(URL).post(redirectURL).reply(503)
            , success     = nock(URL).post(redirectURL).reply(200, {return_value : HOST})
            , connection  = nock(URL).post(generate('connect')).reply(200, response)
            ;

          api.connect(function test(error, response, json) {
            bad = error;
            ssc = response;
            raw = json;

            failure.done();
            success.done();
            connection.done();
            done();
          });
        });

        after(function () {
          slow();
        });

        it("should not error out", function () {
          should.not.exist(bad);
        });

        it("should have a run ID", function () {
          expect(ssc.agent_run_id).equal(RUN_ID);
        });

        it("should pass through server-side configuration untouched", function () {
          expect(ssc).eql(valid);
        });

        it("should pass through exactly what it got back from the server", function () {
          expect(raw).eql(response);
        });
      });

      describe("succeeds after five 503s on get_redirect_host", function () {
        var RUN_ID = 1337
          , bad
          , ssc
          , raw
          ;

        var valid = {
          capture_params : true,
          agent_run_id   : RUN_ID
        };

        var response = {return_value : valid};

        before(function (done) {
          fast();

          var redirectURL = generate('get_redirect_host')
            , failure     = nock(URL).post(redirectURL).times(5).reply(503)
            , success     = nock(URL).post(redirectURL).reply(200, {return_value : HOST})
            , connection  = nock(URL).post(generate('connect')).reply(200, response)
            ;

          api.connect(function test(error, response, json) {
            bad = error;
            ssc = response;
            raw = json;

            failure.done();
            success.done();
            connection.done();
            done();
          });
        });

        after(function () {
          slow();
        });

        it("should not error out", function () {
          should.not.exist(bad);
        });

        it("should have a run ID", function () {
          expect(ssc.agent_run_id).equal(RUN_ID);
        });

        it("should pass through server-side configuration untouched", function () {
          expect(ssc).eql(valid);
        });

        it("should pass through exactly what it got back from the server", function () {
          expect(raw).eql(response);
        });
      });
    });

    describe("off the happy path", function () {
      describe("fails after six 503s on get_redirect_host", function () {
        var captured
          , body
          , raw
          ;

        before(function (done) {
          fast();

          var redirectURL = generate('get_redirect_host')
            , failure     = nock(URL).post(redirectURL).times(6).reply(503)
            ;

          api.connect(function test(error, response, json) {
            captured = error;
            body     = response;
            raw      = json;

            failure.done();
            done();
          });
        });

        after(function () {
          slow();
        });

        it("should have gotten an error", function () {
          should.exist(captured);
        });

        it("should have passed on the status code", function () {
          expect(captured.statusCode).equal(503);
        });

        it("should have included an informative error message", function () {
          expect(captured.message)
            .equal("No body found in response to get_redirect_host.");
        });

        it("should not have a response body", function () {
          should.not.exist(body);
        });
      });

      describe("fails on receiving InvalidLicenseKey", function () {
        var captured
          , data
          , raw
          ;

        var response = {
          exception : {
            message    : 'Invalid license key. Please contact support@newrelic.com.',
            error_type : 'NewRelic::Agent::LicenseException'
          }
        };

        before(function (done) {
          fast();
          var redirectURL = generate('get_redirect_host')
            , failure     = nock(URL).post(redirectURL).reply(200, response)
            ;

          api.connect(function test(error, response, json) {
            captured = error;
            data     = response;
            raw      = json;

            failure.done();
            done();
          });
        });

        after(function () {
          slow();
        });

        it("should have gotten an error", function () {
          should.exist(captured);
        });

        it("should have a status code on the error", function () {
          expect(captured.statusCode).equal(200);
        });

        it("should have included an informative error message", function () {
          expect(captured.message)
            .equal("Invalid license key. Please contact support@newrelic.com.");
        });

        it("should have included the New Relic error class", function () {
          expect(captured.class).equal("NewRelic::Agent::LicenseException");
        });

        it("should have no return value", function () {
          should.not.exist(data);
        });

        it("should have passed along raw response", function () {
          expect(raw).eql(response);
        });
      });

      describe("fails on receiving InvalidLicenseKey after one 503", function () {
        var captured
          , data
          , raw
          ;

        var response = {
          exception : {
            message    : 'Invalid license key. Please contact support@newrelic.com.',
            error_type : 'NewRelic::Agent::LicenseException'
          }
        };

        before(function (done) {
          fast();

          var redirectURL = generate('get_redirect_host')
            , failure     = nock(URL).post(redirectURL).reply(503)
            , license     = nock(URL).post(redirectURL).reply(200, response)
            ;

          api.connect(function test(error, response, json) {
            captured = error;
            data     = response;
            raw      = json;

            failure.done();
            license.done();
            done();
          });
        });

        after(function () {
          slow();
        });

        it("should have gotten an error", function () {
          should.exist(captured);
        });

        it("should have a status code on the error", function () {
          expect(captured.statusCode).equal(200);
        });

        it("should have included an informative error message", function () {
          expect(captured.message)
            .equal("Invalid license key. Please contact support@newrelic.com.");
        });

        it("should have included the New Relic error class", function () {
          expect(captured.class).equal("NewRelic::Agent::LicenseException");
        });

        it("should have no return value", function () {
          should.not.exist(data);
        });

        it("should have passed along raw response", function () {
          expect(raw).eql(response);
        });
      });
    });
  });
});
