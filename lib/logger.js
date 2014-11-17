'use strict'

var Logger = require('./util/logger')
var fs = require('fs')

// create bootstrapping logger
module.exports = new Logger({
  name   : 'newrelic_bootstrap',
  stream : process.stdout,
  level  : 'info'
})

/**
 * Don't load config.js until this point, because it requires this
 * module, and if it gets loaded too early, module.exports will have no
 * value.
 */
var config = require('./config.js').initialize()

var options = {
  name: 'newrelic',
  level: config.logging.level
}

switch (config.logging.filepath) {
  case 'stdout':
    options.stream = process.stdout
  break

  case 'stderr':
    options.stream = process.stderr
  break

  default:
    options.stream = fs.createWriteStream(config.logging.filepath, {flags: 'a+'})
}

// create the "real" logger
module.exports = new Logger(options)

// now tell the config module to switch to the real logger
config.setLogger(module.exports)
