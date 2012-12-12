'use strict';

var path    = require('path')
  , test    = require('tap').test
  , logger  = require(path.join(__dirname, '..', '..', '..', '..', 'lib', 'logger'))
  , helper  = require(path.join(__dirname, '..', '..', '..', 'lib', 'agent_helper'))
  , request = require('request')
  ;

var BODY = "<!DOCTYPE html>\n" +
           "<html>\n" +
           "<head>\n" +
           "  <title>yo dawg</title>\n" +
           "</head>\n" +
           "<body>\n" +
           "  <p>I heard u like HTML.</p>\n" +
           "</body>\n" +
           "</html>\n";

test("Express 2 with EJS templates",
     {timeout : 2000},
     function (t) {
  t.plan(3);

  var agent = helper.instrumentMockedAgent();

  var express = require('express')
    , app     = express.createServer()
    ;

  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.set('view options', {layout : false});

  app.get('/', function (req, res) {
    res.render('index', { title: 'yo dawg' });
  });

  app.listen(8765);

  this.tearDown(function () {
    app.close();
  });

  agent.once('transactionFinished', function () {
    var stats = agent.metrics.getMetric('View/index/Rendering').stats;
    t.equal(stats.callCount, 1, "should note the view rendering");
  });

  request('http://localhost:8765/', function (error, response, body) {
    if (error) t.fail(error);

    t.equal(response.statusCode, 200, "response code should be 200");
    t.equal(body, BODY, "template should still render fine");

    t.end();
  });
});
