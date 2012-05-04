var should  = require('should')
  , path    = require('path')
  , http    = require('http')
  , request = require('request')
  , mocker  = require(path.join(__dirname, 'lib', 'mock_connection'))
  , NR      = require(path.join(__dirname, '..', 'lib', 'newrelic_agent.js'))
  ;

describe('agent instrumentation of the http module', function () {
  var agent;

  before(function (done) {
    var connection = new mocker.Connection();
    agent = new NR({connection : connection});

    return done();
  });

  it("should record stats after a normal request", function (done) {
    var page = '<html><head><title>test response</title></head><body><p>I heard you like HTML.</p></body></html>';

    var server = http.createServer(function (request, response) {
      response.writeHead(200, {'Content-Length' : page.length, 'Content-Type' : 'text/html'});
      response.end(page);
    });

    server.listen(8123, 'localhost', function () {
      request.get('http://localhost:8123/path', function (error, response, body) {
        if (error) return done(error);

        response.statusCode.should.equal(200);

        var stats = JSON.stringify(agent.statsEngine.unscopedStats.byName('WebTransaction/Uri/path'));
        should.exist(stats);
        stats.should.match(/^\[[0-9.,]+\]$/);

        should.exist(body);
        body.should.equal(page);

        return done();
      });
    });
  });
});
