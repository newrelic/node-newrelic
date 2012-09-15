'use strict';

var fs           = require('fs')
  , path         = require('path')
  , carrier      = require('carrier')
  , spawn        = require('child_process').spawn
  ;

var redisProcess;

var api = {
  redisProcess : {
    shutdown : function (callback) {
      if (redisProcess) redisProcess.kill();
      console.error('Redis killed.');
    }
  }
};

module.exports = function setup(options, imports, register) {
  var logger = options.logger;
  logger.debug('starting Redis');

  redisProcess = spawn('redis-server', [],
                       {stdio : [process.stdin, 'pipe', 'pipe']});

  redisProcess.on('exit', function (code, signal) {
    logger.info('redis exited with signal %s and returned code %s', signal, code);
  });

  carrier.carry(redisProcess.stdout, function (line) {
    logger.debug(line);

    if (line.match(/now ready to accept connections/)) return register(null, api);
  });

  carrier.carry(redisProcess.stderr, function (line) {
    logger.error(line);
  });
};
