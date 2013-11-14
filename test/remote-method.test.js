'use strict';

var path         = require('path')
  , url          = require('url')
  , chai         = require('chai')
  , expect       = chai.expect
  , should       = chai.should()
  , RemoteMethod = require(path.join(__dirname, '..', 'lib',
                                   'collector', 'remote-method.js'))
  ;

describe("RemoteMethod", function () {
  it("should require a name for the method to call", function () {
    var method;
    expect(function () { method = new RemoteMethod(); }).throws();
  });

  it("should expose a call method as its public API", function () {
    expect(new RemoteMethod('test').call).a('function');
  });

  it("should expose its name", function () {
    expect(new RemoteMethod('test').name).equal('test');
  });

  describe("when calling a method on the collector", function () {
    it("should pass error to the callback when serialization fails", function (done) {
      var config = {
        port : 80,
        host : 'collector.newrelic.com'
      };

      var method = new RemoteMethod('test', config);

      var problematic = {};
      problematic.parent = problematic;

      method.call(problematic, function (error) {
        expect(error.message).equal('Converting circular structure to JSON');
        done();
      });
    });
  });

  describe("when posting to collector", function () {
    var RUN_ID = 1337
      , URL    = 'http://collector.newrelic.com'
      , nock
      , method
      , sendMetrics
      ;

    before(function () {
      // order dependency: requiring nock at the top of the file breaks other tests
      nock = require('nock');
    });

    after(function () {
      nock.restore();
    });

    beforeEach(function () {
      var config = {
        host        : 'collector.newrelic.com',
        port        : 80,
        run_id      : RUN_ID,
        license_key : 'license key here'
      };
      method = new RemoteMethod('metric_data', config);
    });

    function generate(method, runID) {
      var fragment = '/agent_listener/invoke_raw_method?' +
        'marshal_format=json&protocol_version=12&' +
        'license_key=license%20key%20here&method=' + method;

      if (runID) fragment += '&run_id=' + runID;

      return fragment;
    }

    describe("successfully", function () {
      beforeEach(function () {
        // nock ensures the correct URL is requested
        sendMetrics = nock(URL).post(generate('metric_data', RUN_ID)).reply(200);
      });

      it("should invoke the callback without error", function (done) {
        method._post('[]', function (error) {
          should.not.exist(error);
          done();
        });
      });

      it("should use the right URL", function (done) {
        method._post('[]', function () {
          expect(sendMetrics.isDone()).equal(true);
          done();
        });
      });
    });

    describe("unsuccessfully", function () {
      beforeEach(function () {
        // whoops
        sendMetrics = nock(URL).post(generate('metric_data', RUN_ID)).reply(500);
      });

      it("should invoke the callback with an error", function (done) {
        method._post('[]', function (error) {
          should.exist(error);
          done();
        });
      });

      it("should say what the error was", function (done) {
        method._post('[]', function (error) {
          expect(error.message).equal("Got HTTP 500 in response to metric_data.");
          done();
        });
      });

      it("should include the status code on the error", function (done) {
        method._post('[]', function (error) {
          expect(error.statusCode).equal(500);
          done();
        });
      });
    });
  });

  describe("when generating headers for a plain request", function () {
    var headers;

    beforeEach(function () {
      var config = {
        host       : 'collector.newrelic.com',
        port       : '80',
        run_id     : 12
      };
      var method = new RemoteMethod('test', config);

      headers = method._headers(4, false);
    });

    it("should use the content type from the parameter", function () {
      expect(headers["CONTENT-ENCODING"]).equal("identity");
    });

    it("should use the content length from the parameter", function () {
      expect(headers["Content-Length"]).equal(4);
    });

    it("should use a keepalive connection", function () {
      expect(headers.Connection).equal("Keep-Alive");
    });

    it("should have the host from the configuration", function () {
      expect(headers.Host).equal("collector.newrelic.com");
    });

    it("should tell the server we're sending JSON", function () {
      expect(headers["Content-Type"]).equal("application/json");
    });

    it("should have a user-agent string", function () {
      expect(headers["User-Agent"]).not.equal(undefined);
    });
  });

  describe("when generating headers for a compressed request", function () {
    var headers;

    beforeEach(function () {
      var config = {
        host       : 'collector.newrelic.com',
        port       : '80',
        run_id     : 12
      };
      var method = new RemoteMethod('test', config);

      headers = method._headers(4, true);
    });

    it("should use the content type from the parameter", function () {
      expect(headers["CONTENT-ENCODING"]).equal("deflate");
    });

    it("should use the content length from the parameter", function () {
      expect(headers["Content-Length"]).equal(4);
    });

    it("should use a keepalive connection", function () {
      expect(headers.Connection).equal("Keep-Alive");
    });

    it("should have the host from the configuration", function () {
      expect(headers.Host).equal("collector.newrelic.com");
    });

    it("should tell the server we're sending JSON", function () {
      expect(headers["Content-Type"]).equal("application/octet-stream");
    });

    it("should have a user-agent string", function () {
      expect(headers["User-Agent"]).not.equal(undefined);
    });
  });

  describe("when generating a request URL", function () {
    var TEST_RUN_ID  = Math.floor(Math.random() * 3000)
      , TEST_METHOD  = 'TEST_METHOD'
      , TEST_LICENSE = 'hamburtson'
      , config
      , parsed
      ;

    function reconstitute(generated) {
      return url.parse(generated, true, false);
    }

    beforeEach(function () {
      config = {
        host        : 'collector.newrelic.com',
        port        : 80,
        license_key : TEST_LICENSE
      };
      var method = new RemoteMethod(TEST_METHOD, config);
      parsed = reconstitute(method._path());
    });

    it("should say that it supports protocol 12", function () {
      expect(parsed.query.protocol_version).equal('12');
    });

    it("should tell the collector it's sending JSON", function () {
      expect(parsed.query.marshal_format).equal('json');
    });

    it("should pass through the license key", function () {
      expect(parsed.query.license_key).equal(TEST_LICENSE);
    });

    it("should include the method", function () {
      expect(parsed.query.method).equal(TEST_METHOD);
    });

    it("shouldn't include the agent run ID when not set", function () {
      var method = new RemoteMethod(TEST_METHOD, config);
      parsed = reconstitute(method._path());
      should.not.exist(parsed.query.run_id);
    });

    it("should include the agent run ID when set", function () {
      config.run_id = TEST_RUN_ID;
      var method = new RemoteMethod(TEST_METHOD, config);
      parsed = reconstitute(method._path());
      expect(parsed.query.run_id).equal('' + TEST_RUN_ID);
    });

    it("should start with the (old-style) path", function () {
      expect(parsed.pathname.indexOf('/agent_listener/invoke_raw_method')).equal(0);
    });

    describe("when proxy is configured", function () {
      it("should attach proxy host and port during URL canonicalization", function () {
        var config = {
          proxy_host : 'localhost',
          proxy_port : '8765',
          host       : 'collector.newrelic.com',
          port       : '80',
          run_id     : 12
        };
        var method = new RemoteMethod('test', config);

        var expected = 'http://collector.newrelic.com:80' +
                       '/agent_listener/invoke_raw_method' +
                       '?marshal_format=json&protocol_version=12&' +
                       'license_key=&method=test&run_id=12';
        expect(method._path()).equal(expected);
      });

      it("should proxyify host when proxy settings are complete", function () {
        config.proxy_host = 'proxy.example.com';
        config.proxy_port = 8080;
        var method = new RemoteMethod(TEST_METHOD, config);
        parsed = reconstitute(method._path());
        expect(parsed.hostname).equal('collector.newrelic.com');
      });

      it("should proxyify port when proxy settings are complete", function () {
        config.proxy_host = 'proxy.example.com';
        config.proxy_port = 12345;
        var method = new RemoteMethod(TEST_METHOD, config);
        parsed = reconstitute(method._path());
        expect(parsed.port).equal('80');
      });

      it("should proxyify host when proxy_port is set", function () {
        config.proxy_port = 8080;
        var method = new RemoteMethod(TEST_METHOD, config);
        parsed = reconstitute(method._path());
        expect(parsed.hostname).equal('collector.newrelic.com');
      });

      it("should proxyify port when proxy_host is set", function () {
        config.proxy_host = 'proxy.example.com';
        var method = new RemoteMethod(TEST_METHOD, config);
        parsed = reconstitute(method._path());
        expect(parsed.port).equal('80');
      });
    });
  });

  describe("when generating the User-Agent string", function () {
    var TEST_VERSION = '0-test'
      , ua
      ;

    before(function () {
      var config = {version : '0-test'}
        , method = new RemoteMethod('test', config)
        ;

      ua = method._userAgent();
    });

    it("should clearly indicate it's New Relic for Node", function () {
      expect(ua).include('NewRelic-NodeAgent');
    });

    it("should include the agent version", function () {
      expect(ua).include(TEST_VERSION);
    });

    it("should include node's version", function () {
      expect(ua).include(process.versions.node);
    });

    it("should include node's platform and architecture", function () {
      expect(ua).include(process.platform + '-' + process.arch);
    });
  });
});
