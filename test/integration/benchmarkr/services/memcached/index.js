'use strict'

var carrier = require('carrier')
  , spawn   = require('child_process').spawn
  

var memcachedProcess
function shutdown(callback) {
      if (memcachedProcess) memcachedProcess.kill()
      console.error('memcached killed.')
      // HAX: Node v0.6.11 and earlier hang because the stdin getter is buggy
      process.stdin.pause()

      if (callback) return callback()

}

var api = {
  memcachedProcess : {
    shutdown  : shutdown
  },
  onDestroy : shutdown
}

module.exports = function setup(options, imports, register) {
  var logger = options.logger
  logger.info('starting memcached')

  memcachedProcess = spawn('memcached', ['-v'],
                           {stdio : [process.stdin, 'pipe', 'pipe']})

  memcachedProcess.on('exit', function (code, signal) {
    logger.info('memcached exited with signal %s and returned code %s', signal, code)
  })

  carrier.carry(memcachedProcess.stdout, function (line) {
    logger.debug(line)
  })

  carrier.carry(memcachedProcess.stderr, function (line) {
    logger.error(line)
  })

  // memcached is the strong, silent type and doesn't indicate it's ready
  return register(null, api)
}
