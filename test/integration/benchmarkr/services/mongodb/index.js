'use strict'

var fs           = require('fs')
  , path         = require('path')
  , carrier      = require('carrier')
  , spawn        = require('child_process').spawn
  

var MONGO_LOG_REGEXP = /(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) [0-9]+ [0-9:]+ (.+)$/
var mongoProcess
function shutdown(callback) {
  carrier.carry(mongoProcess.stdout, function (line) {
    if (line.match(/dbexit: really exiting now/)) {
      console.error('MongoDB killed.')
      // HAX: Node v0.6.11 and earlier hang because the stdin getter is buggy
      process.stdin.pause()

      if (callback) return callback()
    }
  })

  if (mongoProcess) mongoProcess.kill()
}

var api = {
  mongodbProcess : {
    shutdown   : shutdown
  },
  onDestroy : shutdown
}

function spawnMongo(options, next) {
  var logger = options.logger
  logger.info('starting MongoDB')

  mongoProcess = spawn('mongod',
                       [
                         '--dbpath', options.dbpath,
                         '--nohttpinterface'
                       ],
                       {stdio : [process.stdin, 'pipe', 'pipe']})

  mongoProcess.on('exit', function (code, signal) {
    logger.info('mongod exited with signal %s and returned code %s', signal, code)
  })

  carrier.carry(mongoProcess.stdout, function (line) {
    logger.debug(line.replace(MONGO_LOG_REGEXP, '$3'))

    if (line.match(/waiting for connections on/)) return next(null, api)
  })

  carrier.carry(mongoProcess.stderr, function (line) {
    logger.error(line)
  })
}

module.exports = function setup(options, imports, register) {
  var dbpath = options.dbpath

  var exist = fs.exists || path.exists

  exist(dbpath, function (exists) {
    if (!exists) {
      fs.mkdir(dbpath, '0755', function (err) {
        if (err) return register(err)

        spawnMongo(options, register)
      })
    }
    else {
      spawnMongo(options, register)
    }
  })
}
