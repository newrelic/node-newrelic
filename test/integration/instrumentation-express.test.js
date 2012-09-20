'use strict';

var path    = require('path')
  , chai    = require('chai')
  , expect  = chai.expect
  , should  = chai.should()
  , request = require('request')
  , helper  = require(path.join(__dirname, '..', 'lib', 'agent_helper'))
  , shimmer = require(path.join(__dirname, '..', '..', 'lib', 'shimmer'))
  ;

describe("agent instrumentation of Express", function () {
  var agent
    , app
    ;

  beforeEach(function () {
    agent = helper.loadMockedAgent();
    shimmer.bootstrapInstrumentation(agent);

    // express.createServer() went away sometime after Express 2.4.3
    // Customer in NA-46 is / was using Express 2.4.3
    app = require('express').createServer();
  });

  afterEach(function () {
    helper.unloadAgent(agent);
  });

  it("should time the request cycle properly (NA-46)", function (done) {
    this.timeout(5 * 1000);

    var TEST_PATH = '/test'
      , TEST_PORT = 9876
      , TEST_HOST = 'localhost'
      , TEST_URL  = 'http://' + TEST_HOST + ':' + TEST_PORT + TEST_PATH
      , DELAY     = 2100
      , PAGE      = '<html>' +
                    '<head><title>test response</title></head>' +
                    '<body><p>I heard you like HTML.</p></body>' +
                    '</html>'
      ;

    app.get(TEST_PATH, function (request, response) {
      should.exist(agent.getTransaction());
      response.writeHead(200, {'Content-Length' : PAGE.length, 'Content-Type' : 'text/html'});
      setTimeout(function () { response.end(PAGE); }, DELAY);
    });

    app.listen(TEST_PORT, TEST_HOST, function ready() {
      request.get(TEST_URL, function (error, response, body) {
        if (error) return done(error);
        should.not.exist(agent.getTransaction());

        expect(body).equal(PAGE);
        var timing = agent.metrics.getMetric('WebTransaction/Uri/test').stats.total * 1000;
        expect(timing).above(DELAY - 100); // setTimeout is a little sloppy, yo

        return done();
      });
    });
  });
});
