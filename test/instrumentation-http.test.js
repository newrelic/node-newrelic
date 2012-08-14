'use strict';

var path    = require('path')
  , chai    = require('chai')
  , should  = chai.should()
  , http    = require('http')
  , helper  = require(path.join(__dirname, 'lib', 'agent_helper'))
  , shimmer = require(path.join(__dirname, '..', 'lib', 'shimmer'))
  ;

describe('agent instrumentation of the http module', function () {
  var agent
    , fetchedResponse
    , fetchedBody;

  var PAGE = '<html><head><title>test response</title></head><body><p>I heard you like HTML.</p></body></html>';

  before(function (done) {
    agent = helper.loadMockedAgent();
    shimmer.bootstrapInstrumentation(agent);

    var server = http.createServer(function (request, response) {
      response.writeHead(200, {'Content-Length' : PAGE.length, 'Content-Type' : 'text/html'});
      response.end(PAGE);
    });

    server.listen(8123, 'localhost', function () {
      fetchedBody = '';
      var req = http.request({port   : 8123,
                              host   : 'localhost',
                              path   : '/path',
                              method : 'GET'},
                             function (response) {
                               if (response.statusCode !== 200) return done(response.statusCode);

                               fetchedResponse = response;

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

  after(function (done) {
    helper.unloadAgent(agent);

    return done();
  });

  it("should successfully fetch the page", function (done) {
    fetchedResponse.statusCode.should.equal(200);

    should.exist(fetchedBody);
    fetchedBody.should.equal(PAGE);

    return done();
  });

  it("should record unscoped path stats after a normal request", function (done) {
    var pathStats = agent.statsEngine.unscopedStats.byName('WebTransaction/Uri/path').toJSON();
    pathStats[0].should.equal(1);

    return done();
  });

  it("should indicate that the http dispatcher is in play", function (done) {
    var found = false;

    agent.environment.toJSON().forEach(function (pair) {
      if (pair[0] === 'Dispatcher' && pair[1] === 'http') found = true;
    });

    return done(found ? null : new Error('failed to find Dispatcher configuration'));
  });

  it("should record unscoped HTTP dispatcher stats after a normal request", function (done) {
    var dispatchStats = agent.statsEngine.unscopedStats.byName('HttpDispatcher').toJSON();
    dispatchStats[0].should.equal(1);

    return done();
  });
});
