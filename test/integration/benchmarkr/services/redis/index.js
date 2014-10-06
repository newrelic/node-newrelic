'use strict'

var fs           = require('fs')
  , path         = require('path')
  , carrier      = require('carrier')
  , spawn        = require('child_process').spawn
  

var REDIS_LOG_REGEXP = / [0-9]+ (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) [0-9:]+( -)?/
var redisProcess
function shutdown(callback) {
  if (redisProcess) redisProcess.kill()
  console.error('Redis killed.')

  if (callback) return callback()
}

var api = {
  redisProcess : {
    shutdown  : shutdown
  },
  onDestroy : shutdown
}

module.exports = function setup(options, imports, register) {
  var logger = options.logger
  logger.info('starting Redis')

  redisProcess = spawn('redis-server', ['--save', ''],
                       {stdio : [process.stdin, 'pipe', 'pipe']})

  redisProcess.on('exit', function (code, signal) {
    logger.info('redis exited with signal %s and returned code %s', signal, code)
  })

  carrier.carry(redisProcess.stdout, function (line) {
    logger.debug(line.replace(REDIS_LOG_REGEXP, ''))

    if (line.match(/now ready to accept connections/)) return register(null, api)
  })

  carrier.carry(redisProcess.stderr, function (line) {
    logger.error(line)
  })
}
