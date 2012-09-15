'use strict';

var fs           = require('fs')
  , path         = require('path')
  , carrier      = require('carrier')
  , spawn        = require('child_process').spawn
  ;

var mprocess;

var api = {
  mongodb : {
    shutdown : function (callback) {
      if (mprocess) mprocess.kill();
      console.error('MongoDB killed.');
    }
  }
};

function spawnMongo(options, next) {
  var logger = options.logger;
  logger.debug('starting up MongoDB');

  mprocess = spawn('mongod',
                  [
                    '--dbpath', options.dbpath,
                    '--nohttpinterface'
                  ],
                  {stdio : [process.stdin, 'pipe', 'pipe']});

  mprocess.on('exit', function (code, signal) {
    logger.info('mongod exited with signal %s and returned code %s', signal, code);
  });

  carrier.carry(mprocess.stdout, function (line) {
    logger.debug(line);

    if (line.match(/waiting for connections on/)) return next(null, api);
  });

  carrier.carry(mprocess.stderr, function (line) {
    logger.error(line);
  });
}

module.exports = function setup(options, imports, register) {
  var dbpath = options.dbpath;

  fs.exists(dbpath, function (exists) {
    if (!exists) {
      fs.mkdir(dbpath, '0755', function (err) {
        if (err) return register(err);

        spawnMongo(options, register);
      });
    }
    else {
      spawnMongo(options, register);
    }
  });
};
