'use strict'

module.exports = function setup(options, imports, register) {
  var logger           = options.logger
    , mongodbProcess   = imports.mongodbProcess
    , mysqldProcess    = imports.mysqldProcess
    , redisProcess     = imports.redisProcess
    , memcachedProcess = imports.memcachedProcess
    

  function quit(code) {
    mongodbProcess.shutdown()
    mysqldProcess.shutdown()
    redisProcess.shutdown()
    memcachedProcess.shutdown()

    process.exit(code)
  }

  process.on('SIGINT', function () {
    console.error("Got SIGINT. Shutting down.")
    quit(0)
  })

  return register(null, {
    shutdown : {
      quit : quit
    }
  })
}
