'use strict';

var path = require('path')
  , chai = require('chai')
  , expect = chai.expect
  , DataSender = require(path.join(__dirname, '..', 'lib', 'collector', 'data-sender'))
  ;

describe("DataSender", function () {
  describe("with compression", function () {
    it("should stream correctly-compressed data");
    it("should signal the correct content type");
  });

  it("should deliver payloads to the correct destination via proxies");
  it("should time out when connections take too long");

  it("should attach proxy host and port during URL canonicalization", function () {
    var config = {
      proxy_host : 'localhost',
      proxy_port : '8765',
      host       : 'collector.newrelic.com',
      port       : '80'
    };
    var sender = new DataSender(config, 12);

    var raw = '/listener/invoke';
    var expected = 'http://collector.newrelic.com:80/listener/invoke';
    expect(sender.canonicalizeURL(raw)).equal(expected);
  });

  describe("when generating headers", function () {
    var headers;

    beforeEach(function () {
      var config = {
        host       : 'collector.newrelic.com',
        port       : '80'
      };
      var sender = new DataSender(config, 12);

      headers = sender.createHeaders('identity', 80);
    });

    it("should use the content type from the parameter", function () {
      expect(headers["CONTENT-ENCODING"]).equal("identity");
    });

    it("should use the content length from the parameter", function () {
      expect(headers["Content-Length"]).equal(80);
    });

    it("should use a keepalive connection for reasons that escape me", function () {
      expect(headers.Connection).equal("Keep-Alive");
    });

    it("should have the host from the configuration", function () {
      expect(headers.host).equal("collector.newrelic.com");
    });

    it("should tell the server we're sending JSON", function () {
      expect(headers["Content-Type"]).equal("application/json");
    });

    it("should have a user-agent string", function () {
      expect(headers["User-Agent"]).not.equal(undefined);
    });
  });

  describe("when performing RPC against the collector", function () {
    var sender
      , mockSender
      , TEST_RUN_ID = Math.floor(Math.random() * 3000)
      ;

    beforeEach(function () {
      var config = {
        host        : 'collector.newrelic.com',
        port        : '80',
        license_key : 'hamburtson'
      };
      sender = new DataSender(config, TEST_RUN_ID);
      mockSender = sinon.mock(sender);
    });

    it("should always add the agent run ID, if set", function () {
      var METHOD = 'TEST'
        , PARAMS = {test : "value"}
        , URL    = sinon.match(new RegExp('agent_run_id=' + TEST_RUN_ID))
        ;

      mockSender.expects('send').once().withExactArgs(METHOD, URL, PARAMS);
      sender.invokeMethod(METHOD, PARAMS);

      mockSender.verify();
    });

    it("should correctly set up the method", function () {
      var METHOD = 'TEST'
        , PARAMS = {test : "value"}
        , URL    = sinon.match(new RegExp('method=' + METHOD))
        ;

      mockSender.expects('send').once().withExactArgs(METHOD, URL, PARAMS);
      sender.invokeMethod(METHOD, PARAMS);

      mockSender.verify();
    });
  });
});
