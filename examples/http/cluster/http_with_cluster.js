'use strict';

require('newrelic');

var cluster = require('cluster')
  , http    = require('http')
  , os      = require('os')
  , logger  = require('../../../lib/logger').child({component : 'http_cluster'})
  ;

if (cluster.isMaster) {
  for (var i = 0; i < os.cpus().length; i++) {
    var worker = cluster.fork();
    console.log("started worker with pid %d", worker.process.pid);
  }

  cluster.on('exit', function (worker, code, signal) {
    logger.info('worker %d died', worker.process.pid);
  });
}
else {
  var server = http.createServer(function (request, response) {
    var body = '<html><head><title>yo dawg</title></head><body><p>I heard you like HTML.</p></body></html>';
    response.writeHead(200, {'Content-Length' : body.length, 'Content-Type' : 'text/html'});
    response.end(body);
  });

  server.listen(8088);
}
