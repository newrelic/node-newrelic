'use strict';

var path    = require('path')
  , test    = require('tap').test
  , request = require('request')
  , helper  = require(path.join(__dirname, '..', '..', 'lib', 'agent_helper.js'))
  , API     = require(path.join('..', '..', '..', 'api.js'))
  ;

test("Restify router introspection", function (t) {
  t.plan(3);

  var agent  = helper.instrumentMockedAgent()
    , server = require('restify').createServer()
    , api    = new API(agent)
    ;

  agent.config.application_id = '12345';
  agent.config.browser_monitoring.browser_key = '12345';

  this.tearDown(function () {
    server.close(function () {
      helper.unloadAgent(agent);
    });
  });

  server.get('/test/:id', function (req, res, next) {
    var rum = api.getBrowserTimingHeader();
    t.equal(rum.substr(0,7), '<script');
    res.send({status : 'ok'});
    next();
  });

  server.listen(8080, function () {
    request.get('http://localhost:8080/test/31337',
                {json : true},
                function (error, res, body) {

      t.equal(res.statusCode, 200, "nothing exploded");
      t.deepEqual(body, {status : 'ok'}, "got expected respose");
      t.end();
    });
  });
});
