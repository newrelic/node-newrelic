'use strict'

var fs      = require('fs')
  , path    = require('path')
  , spawn   = require('child_process').spawn
  , carrier = require('carrier')
  , Q       = require('q')
  , mkdirp  = require('mkdirp')
  

var MYSQL_LOG_REGEXP = /^([0-9]+) [0-9:]+/

function slice(args) {
  // Array.prototype.slice on arguments arraylike is expensive
  var l = args.length, a = [], i
  for (i = 0; i < l; i++) {
    a[i] = args[i]
  }
  return a
}

module.exports = function setup(options, imports, register) {
  var dbpath = options.dbpath
    , logger = options.logger
    

  function run() {
    var commands = slice(arguments)
    return commands.reduce(
      function (last, next) { return last.then(next); },
      Q.resolve()
    )
  }

  function dataDirExists() {
    return Q.nfcall((fs.exists || path.exists), dbpath).then(function cb_then(exists) {
      if (!exists) throw new Error(dbpath + " doesn't exist.")
    })
  }

  function makeDataDir() {
    logger.debug("Creating %s.", dbpath)

    return Q.nfcall(mkdirp, dbpath, {mode: '0755'})
  }

  function findInstallDir() {
    logger.debug("Finding MySQL install path.")
    var deferred = Q.defer()

    /* Presumes you're on a system grownup enough to have a 'which' that's not
     * just a shell built-in. Not going to work on Windows, sorry. Send me a
     * pull request.
     */
    var findConfig = spawn('which',
                           ['my_print_defaults'],
                           {stdio : [process.stdin, 'pipe', 'pipe']})

    carrier.carry(findConfig.stdout, function (line) {
      fs.readlink(line, function (err, target) {
        // probably not a link, try to proceed with the original file
        if (err) return deferred.resolve(path.dirname(path.dirname(line)))

        var installPath = path.dirname(path.dirname(path.resolve(path.dirname(line),
                                                                 target)))
        return deferred.resolve(installPath)
      })
    })

    carrier.carry(findConfig.stderr, function (line) {
      return deferred.reject(new Error(line))
    })

    return deferred.promise
  }

  function initDataDir(basedir) {
    var deferred = Q.defer()

    logger.debug("Initializing data directory %s using MySQL tools in %s.",
                 dbpath,
                 basedir)

    var init = spawn('mysql_install_db',
                     [
                       '--force',
                       '--basedir=' + basedir,
                       '--datadir=' + dbpath,
                       '--user='    + process.getuid()
                     ],
                     {stdio : [process.stdin, 'pipe', 'pipe']})

    init.on('error', function (err) {
      logger.error(err)
    })

    init.on('exit', function (code, signal) {
      logger.info("MySQL data directory bootstrapped.")
      if (code || signal)
        return deferred.reject(new Error("Boostrapping MySQL Returned Code: " + code))
      else 
        return deferred.resolve()
    })

    carrier.carry(init.stdout, function (line) {
      logger.debug(line)

      if (line.match(/FATAL ERROR/)) return deferred.reject(new Error(line))
    })

    carrier.carry(init.stderr, function (line) {
      logger.error(line)
    })

    return deferred.promise
  }

  function spawnMySQL() {
    logger.info("Starting MySQL!")
    var deferred = Q.defer()

    var mysqldProcess = spawn('mysqld',
                              [
                                '--datadir=' + dbpath,
                                '--socket=/tmp/mysqld.sock',
                                '--pid=/tmp/mysqld.pid'
                              ],
                              {stdio : [process.stdin, 'pipe', 'pipe']})

    mysqldProcess.on('exit', function (code, signal) {
      logger.info("MySQL exited with signal %s and returned code %s",
                  signal,
                  code)
    })

    function shutdown(callback) {
      carrier.carry(mysqldProcess.stderr, function (line) {
        if (line.match(/mysqld: Shutdown complete/)) {
          console.error('MySQL killed.')
          // HAX: Node v0.6.11 and earlier hang because the stdin getter is buggy
          process.stdin.pause()

          if (callback) process.nextTick(callback)
        }
      })

      mysqldProcess.kill()
    }

    carrier.carry(mysqldProcess.stdout, function (line) {
      logger.info(line)
    })

    // mysqld thinks it's better than everyone and puts all its output on stderr
    carrier.carry(mysqldProcess.stderr, function (line) {
      var cleaned = line.replace(MYSQL_LOG_REGEXP, '[$1]')
      logger.debug(cleaned)

      if (line.match(/fatal error/i)) return deferred.reject(new Error(cleaned))

      if (line.match(/mysqld: ready for connections./)) {
        var api = {
          mysqldProcess : {
            shutdown : shutdown
          },
          onDestroy : shutdown // not documented in architect, may go away
        }

        return deferred.resolve(api)
      }
    })

    return deferred.promise
  }

  function succeeded(api) {
    logger.info("MySQL up and running.")
    return register(null, api)
  }

  function failed(error) {
    return register(error)
  }

  dataDirExists().then(
    spawnMySQL,
    function noDataDirYet(error) {
      logger.debug(error.message)

      run(
        makeDataDir,
        findInstallDir,
        initDataDir,
        spawnMySQL
      ).then(succeeded, failed)
    }
  )
}
