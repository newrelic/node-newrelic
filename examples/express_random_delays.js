'use strict';

var agent = require ('newrelic_agent')
  , express = require('express')
  , app = express.createServer()
  , logger = require('../lib/logger')
  ;

app.use(express.logger('dev'));

app.get('*', function (request, response) {
  var body = '<html><head><title>yo dawg</title></head><body><p>I heard you like HTML.</p></body></html>';
  response.writeHead(200, {'Content-Length' : body.length, 'Content-Type' : 'text/html'});

  // let's generate some slow transaction traces
  var wait = Math.random() * 2000;
  console.log("waiting " + wait + " milliseconds to return for " + request.url);

  setTimeout(function () { response.end(body); }, wait);
});

app.listen(8080, 'localhost');
