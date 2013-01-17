'use strict';

var path   = require('path')
  , chai   = require('chai')
  , should = chai.should()
  , expect = chai.expect
  , helper = require(path.join(__dirname, 'lib', 'agent_helper'))
  ;

describe("built-in http module instrumentation", function () {
  var http
    , agent
    ;

  var PAYLOAD = JSON.stringify({msg : 'ok'});

  var PAGE = '<html>' +
    '<head><title>test response</title></head>' +
    '<body><p>I heard you like HTML.</p></body>' +
    '</html>';

  describe("shouldn't cause bootstrapping to fail", function () {
    var initialize
      ;

    before(function () {
      agent = helper.loadMockedAgent();
      initialize = require(path.join(__dirname, '..', 'lib',
                                     'instrumentation', 'core', 'http'));
    });

    it("when passed no module", function () {
      expect(function () { initialize(agent); }).not.throws();
    });

    it("when passed an empty module", function () {
      expect(function () { initialize(agent, {}); }).not.throws();
    });
  });

  describe("when running a request", function () {
    var transaction
      , fetchedStatusCode
      , fetchedBody
      ;

    before(function (done) {
      http  = require('http');
      agent = helper.instrumentMockedAgent();

      var external = http.createServer(function (request, response) {
        should.exist(agent.getTransaction());

        response.writeHead(200,
                           {'Content-Length' : PAYLOAD.length,
                            'Content-Type'   : 'application/json'});
        response.end(PAYLOAD);
      });

      var server = http.createServer(function (request, response) {
        should.exist(agent.getTransaction());

        var req = http.request({port : 8321,
                                host : 'localhost',
                                path : '/status',
                                method : 'GET'},
                                function (requestResponse) {
            if (requestResponse.statusCode !== 200) {
              return done(requestResponse.statusCode);
            }

            transaction = agent.getTransaction();
            should.exist(transaction);

            requestResponse.setEncoding('utf8');
            requestResponse.on('data', function (data) {
              expect(data).equal(PAYLOAD);
            });

            response.writeHead(200,
                               {'Content-Length' : PAGE.length,
                                 'Content-Type'   : 'text/html'});
                                 response.end(PAGE);
          });

          req.on('error', function (error) {
            return done(error);
          });

          req.end();
      });

      external.listen(8321, 'localhost', function () {
        server.listen(8123, 'localhost', function () {
          // The transaction doesn't get created until after the instrumented
          // server handler fires.
          expect(agent.getTransaction()).equal(undefined);

          fetchedBody = '';
          var req = http.request({port   : 8123,
                                  host   : 'localhost',
                                  path   : '/path',
                                  method : 'GET'},
                                  function (response) {
            if (response.statusCode !== 200) {
              return done(response.statusCode);
            }

            fetchedStatusCode = response.statusCode;

            response.setEncoding('utf8');
            response.on('data', function (data) {
              fetchedBody = fetchedBody + data;
            });

            response.on('end', function () {
              return done();
            });
          });

          req.on('error', function (error) {
            return done(error);
          });

          req.end();
        });
      });
    });

    after(function () {
      helper.unloadAgent(agent);
    });

    it("should successfully fetch the page", function () {
      fetchedStatusCode.should.equal(200);

      should.exist(fetchedBody);
      fetchedBody.should.equal(PAGE);
    });

    it("should record unscoped path stats after a normal request", function () {
      var stats = agent.metrics.getOrCreateMetric('WebTransaction/Uri/path').stats;
      stats.callCount.should.equal(1);
    });

    it("should indicate that the http dispatcher is in play", function (done) {
      var found = false;

      agent.environment.toJSON().forEach(function (pair) {
        if (pair[0] === 'Dispatcher' && pair[1] === 'http') found = true;
      });

      return done(found ? null : new Error('failed to find Dispatcher configuration'));
    });

    it("should record unscoped HTTP dispatcher stats after a normal request", function () {
      var stats = agent.metrics.getOrCreateMetric('HttpDispatcher').stats;
      stats.callCount.should.equal(2);
    });

    it("should associate outbound HTTP requests with the inbound transaction", function () {
      var stats = transaction.metrics.getOrCreateMetric('External/localhost/http',
                                                        'External/localhost/status').stats;
                                                        expect(stats.callCount).equal(1);
    });

    it("shouldn't record transactions for requests for favicon.ico");
    it("should capture metrics for the last byte to exit / enter as part of a response / request");
  });

  describe("with error monitor", function () {
    var mochaHandler;

    before(function () {
      mochaHandler = process.listeners('uncaughtException').pop();
    });

    after(function () {
      process.on('uncaughtException', mochaHandler);
    });

    beforeEach(function () {
      http  = require('http');
      agent = helper.instrumentMockedAgent();
    });

    afterEach(function () {
      helper.unloadAgent(agent);
    });

    describe("for http.createServer", function () {
      it("should trace errors in top-level handlers", function (done) {
        var server;
        process.once('uncaughtException', function () {
          var errors = agent.errors.errors;
          expect(errors.length).equal(1);

          server.close();
          return done();
        });

        server = http.createServer(function () {
          throw new Error("whoops!");
        });

        server.listen(8182, function () {
          http.get("http://localhost:8182/", function () {
            console.log("actually got response");
          });
        });
      });
    });

    describe("for http.request", function () {
      it("should trace errors in listeners", function (done) {
        var server;
        process.once('uncaughtException', function () {
          var errors = agent.errors.errors;
          expect(errors.length).equal(1);

          server.close();
          return done();
        });

        server = http.createServer(function (request, response) {
          response.writeHead(200,
                             {'Content-Length' : PAYLOAD.length,
                              'Content-Type'   : 'application/json'});
          response.end(PAYLOAD);
        });

        server.listen(8183, function () {
          helper.runInTransaction(agent, function () {
            http.get("http://localhost:8183/", function () {
              throw new Error("whoah");
            });
          });
        });
      });
    });
  });
});
