'use strict';

var agent = require ('newrelic_agent')
  , http  = require('http')
  , logger = require('../lib/logger')
  ;

var server = http.createServer(function (request, response) {
  var body = '<html><head><title>yo dawg</title></head><body><p>I heard you like HTML.</p></body></html>';
  response.writeHead(200, {'Content-Length' : body.length, 'Content-Type' : 'text/html'});

  // let's generate some slow transaction traces
  var wait = Math.random() * 2000;
  logger.verbose("waiting " + wait + " milliseconds to return for " + request.url);

  // FIXME: this causes the general shim to start complaining
  setTimeout(function () { response.end(body); }, wait);
});

server.listen(8080, 'localhost');
