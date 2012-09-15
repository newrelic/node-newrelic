'use strict';

var fs           = require('fs')
  , path         = require('path')
  , carrier      = require('carrier')
  , spawn        = require('child_process').spawn
  , EventEmitter = require('events').EventEmitter
  ;

var logger;
var bootstrapper = new EventEmitter();
bootstrapper.on('mongoReady', function (next) {
  logger.info("MongoDB says it's ready!");

  return next();
});

var mongoP;
function spawnMongo(dbpath, next) {
  logger.debug('starting up MongoDB');

  mongoP = spawn('mongod',
                 [
                   '--dbpath', dbpath,
                   '--nohttpinterface'
                 ],
                 {stdio : [process.stdin, 'pipe', 'pipe']});

  mongoP.on('exit', function (code, signal) {
    logger.info('mongod exited with signal %s and returned code %s', signal, code);
  });

  carrier.carry(mongoP.stdout, function (line) {
    logger.debug(line);
    if (line.match(/waiting for connections on/)) bootstrapper.emit('mongoReady', next);
  });

  carrier.carry(mongoP.stderr, function (line) {
    logger.error(line);
  });
}

function startMongo(next) {
  var dbpath = path.join(__dirname, 'mongo-everything');
  fs.exists(dbpath, function (exists) {
    if (!exists) {
      fs.mkdir(dbpath, '0755', function (err) {
        if (err) return logger.error(err);
        spawnMongo(dbpath, next);
      });
    }
    else {
      spawnMongo(dbpath, next);
    }
  });
}

function shutdown() {
  if (mongoP) mongoP.kill();
}

process.on('exit', function () {
  logger.info('Shutting down.');
  shutdown();
});

module.exports = function bootstrap(bunyan, next) {
  logger = bunyan;

  logger.debug("entering bootstrapper");
  startMongo(next);
};
