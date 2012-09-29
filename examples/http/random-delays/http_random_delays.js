'use strict';

require('newrelic_agent');

var http   = require('http')
  , logger = require('../lib/logger')
  ;

var server = http.createServer(function (request, response) {
  var body = '<html><head><title>yo dawg</title></head><body><p>I heard you like HTML.</p></body></html>';
  response.writeHead(200, {'Content-Length' : body.length, 'Content-Type' : 'text/html'});

  // let's generate some slow transaction traces
  var wait = Math.random() * 4000;
  if (wait > 2000) logger.verbose("waiting " + wait + " milliseconds to return for " + request.url);

  setTimeout(function () { response.end(body); }, wait);
});

server.listen(8088, 'localhost');
