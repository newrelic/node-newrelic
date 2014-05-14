'use strict';

require('newrelic');

var http  = require('http');

var server = http.createServer(function cb_createServer(request, response) {
  var body = '<html><head><title>yo dawg</title></head><body><p>I heard you like HTML.</p></body></html>';
  response.writeHead(200, {'Content-Length' : body.length, 'Content-Type' : 'text/html'});
  response.end(body);
});

server.listen(8088, 'localhost');
