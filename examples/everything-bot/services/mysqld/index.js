'use strict';

var fs           = require('fs')
  , path         = require('path')
  , carrier      = require('carrier')
  , spawn        = require('child_process').spawn
  ;

var MYSQL_LOG_REGEXP = /^([0-9]+) [0-9:]+/;
var mysqldProcess;

var api = {
  mysqldProcess : {
    shutdown : function (callback) {
      if (mysqldProcess) mysqldProcess.kill();
      console.error('MySQL killed.');
    }
  }
};

function spawnMySQL(options, next) {
  var logger = options.logger;
  logger.info('starting MySQL');

  mysqldProcess = spawn('mysqld',
                        [
                          '--datadir', options.dbpath
                        ],
                        {stdio : [process.stdin, 'pipe', 'pipe']});

  mysqldProcess.on('exit', function (code, signal) {
    logger.info('MySQL exited with signal %s and returned code %s', signal, code);
  });

  carrier.carry(mysqldProcess.stdout, function (line) {
    logger.info(line);
  });

  carrier.carry(mysqldProcess.stderr, function (line) {
    logger.debug(line.replace(MYSQL_LOG_REGEXP, '[$1]'));

    if (line.match(/mysqld: ready for connections./)) return next(null, api);
  });
}

function findInstallDir(options, next) {
  var findConfig
    , configPath = ''
    ;

  findConfig = spawn('which', ['my_print_defaults'],
                     {stdio : [process.stdin, 'pipe', 'pipe']});

  findConfig.on('exit', function () {
    fs.readlink(configPath, function (err, target) {
      if (err) return next(err);

      var installPath = path.dirname(path.dirname(path.resolve(path.dirname(configPath), target)));
      return next(null, installPath);
    });
  });

  carrier.carry(findConfig.stdout, function (line) {
    configPath += line;
  });

  carrier.carry(findConfig.stderr, function (line) {
    var logger = options.logger;
    logger.error(line);
  });
}

function initDatadir(options, next) {
  var creationError;

  findInstallDir(options, function (err, basedir) {
    if (err) return next(err);

    var logger = options.logger;
    logger.debug('initializing MySQL data directory %s with basedir %s',
                 options.dbpath,
                 basedir);

    var init = spawn('mysql_install_db',
                     [
                       '--force',
                       '--basedir=' + basedir,
                       '--datadir=' + options.dbpath
                     ],
                     {stdio : [process.stdin, 'pipe', 'pipe']});

    init.on('exit', function () {
      logger.info('MySQL data directory bootstrapped');
      if (creationError) return next(creationError);

      return spawnMySQL(options, next);
    });

    carrier.carry(init.stdout, function (line) {
      logger.debug(line);

      if (line.match(/FATAL ERROR/)) creationError = line;
    });

    carrier.carry(init.stderr, function (line) {
      logger.error(line);
    });
  });
}

module.exports = function setup(options, imports, register) {
  var dbpath = options.dbpath;

  fs.exists(dbpath, function (exists) {
    if (!exists) {
      fs.mkdir(dbpath, '0755', function (err) {
        if (err) return register(err);

        initDatadir(options, register);
      });
    }
    else {
      spawnMySQL(options, register);
    }
  });
};
