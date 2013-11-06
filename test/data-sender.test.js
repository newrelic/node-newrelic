'use strict';

var path         = require('path')
  , chai         = require('chai')
  , expect       = chai.expect
  , should       = chai.should()
  , EventEmitter = require('events').EventEmitter
  , Stream       = require('stream')
  , DataSender   = require(path.join(__dirname, '..', 'lib', 'collector', 'data-sender'))
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
      port       : '80',
      run_id     : 12
    };
    var sender = new DataSender(config);

    var expected = 'http://collector.newrelic.com:80' +
                   '/agent_listener/invoke_raw_method' +
                   '?marshal_format=json&protocol_version=12&' +
                   'license_key=&method=test&run_id=12';
    expect(sender.getURL('test')).equal(expected);
  });

  it("should require a message type when invoking a remote method", function () {
    var sender = new DataSender();
    expect(function () { sender.invokeMethod(); })
      .throws("Can't send the collector a message without a message type");
  });

  describe("when generating headers for a plain request", function () {
    var headers;

    beforeEach(function () {
      var config = {
        host       : 'collector.newrelic.com',
        port       : '80',
        run_id     : 12
      };
      var sender = new DataSender(config);

      headers = sender.getHeaders(4);
    });

    it("should use the content type from the parameter", function () {
      expect(headers["CONTENT-ENCODING"]).equal("identity");
    });

    it("should use the content length from the parameter", function () {
      expect(headers["Content-Length"]).equal(4);
    });

    it("should use a keepalive connection for reasons that escape me", function () {
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
      var sender = new DataSender(config);

      headers = sender.getHeaders(10, true);
    });

    it("should use the content type from the parameter", function () {
      expect(headers["CONTENT-ENCODING"]).equal("deflate");
    });

    it("should use the content length from the parameter", function () {
      expect(headers["Content-Length"]).equal(10);
    });

    it("should use a keepalive connection for reasons that escape me", function () {
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

  describe("when generating the collector URL", function () {
    var sender
      , TEST_RUN_ID = Math.floor(Math.random() * 3000)
      ;

    beforeEach(function () {
      var config = {
        host        : 'collector.newrelic.com',
        port        : '80',
        license_key : 'hamburtson',
        run_id      : TEST_RUN_ID
      };
      sender = new DataSender(config);
    });

    it("should always add the agent run ID, if set", function () {
      var runPattern = new RegExp('run_id=' + TEST_RUN_ID);
      expect(sender.getURL('TEST_METHOD')).match(runPattern);
    });

    it("should correctly set up the method", function () {
      expect(sender.getURL('TEST_METHOD')).match(/method=TEST_METHOD/);
    });
  });

  describe("when the connection errors", function () {
    it("should emit an error", function (done) {
      var sender = new DataSender({host : 'localhost', port : 8765});

      sender.on('error', function (message, error) {
        expect(message).equal('TEST');
        expect(error.message).equal('connect ECONNREFUSED');

        done();
      });

      var body = '{"message":"none"}';
      sender.postToCollector('TEST', sender.getHeaders(body.length), body);
    });
  });

  describe("when processing a collector response", function () {
    var sender;

    beforeEach(function () {
      sender = new DataSender({host : 'localhost'});
    });

    it("should raise an error if the response has an error status code", function (done) {
      var response = new EventEmitter();
      response.statusCode = 401;

      sender.on('error', function (message, error) {
        expect(error.message).equal("Got HTTP 401 in response to TEST.");

        return done();
      });
      sender.onCollectorResponse('TEST', response);
    });

    it("should hand off the response to the message handler", function (done) {
      var response = new Stream();
      response.setEncoding = function () {}; // fake it til you make it
      response.readable = true;
      response.statusCode = 200;

      var sampleBody = '{"return_value":{"messages":[]}}';

      sender.handleMessage = function (message, error, body) {
        expect(message).equal('TEST');
        should.not.exist(error);
        expect(body).equal(sampleBody);

        return done();
      };

      sender.onCollectorResponse('TEST', response);

      process.nextTick(function () {
        response.emit('data', sampleBody);
        response.emit('end');
      });
    });
  });

  describe("when handling a response's message", function () {
    var sender;

    beforeEach(function () {
      sender = new DataSender({host : 'localhost'});
    });

    it("should hand off decoding errors", function (done) {
      sender.on('error', function (message, error) {
        expect(message).equal('TEST');
        expect(error.message).equal('unspecified decoding error');

        return done();
      });

      sender.handleMessage('TEST', new Error('unspecified decoding error'));
    });

    it("should hand off server exceptions", function (done) {
      sender.on('error', function (message, error) {
        expect(message).equal('TEST');
        expect(error).eql({error_type : 'NewRelic::Agent::ForceRestartException'});

        return done();
      });

      var body = '{"exception":{"error_type":"NewRelic::Agent::ForceRestartException"}}';
      sender.handleMessage('TEST', null, body);
    });

    it("should hand off return_value, if set", function (done) {
      sender.on('response', function (response) {
        expect(response).eql({url_rules : []});

        return done();
      });

      var body = '{"return_value":{"url_rules":[]}}';
      sender.handleMessage('TEST', null, body);
    });
  });

  it("shouldn't throw when dealing with compressed data", function (done) {
    var sender = new DataSender({host : 'localhost'});
    sender.shouldCompress = function () { return true; };
    sender.postToCollector = function (message, headers, deflated) {
      expect(deflated.readUInt8(0)).equal(120);
      expect(deflated.length).equal(14);

      return done();
    };

    sender.invokeMethod('test', 'data');
  });

  it("shouldn't throw when preparing uncompressed data", function (done) {
    var sender = new DataSender({host : 'localhost'});
    sender.postToCollector = function (message, headers, data) {
      expect(data).equal('"data"');

      return done();
    };

    sender.invokeMethod('test', 'data');
  });

  it("should handle DNS lookup errors properly", function (done) {
    var sender =  new DataSender({host : 'failed.domain.cxlrg'});
    sender.once('error', function (message, error) {
      expect(message).equal('TEST');
      should.exist(error);
      // https://github.com/joyent/node/commit/7295bb9435c
      expect(error.message).match(/^getaddrinfo E(NOENT|NOTFOUND)$/);

      return done();
    });

    sender.postToCollector('TEST');
  });
});
