'use strict'

var path   = require('path')
  , Logger = require('bunyan')
  , options
  

var LEVELS = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal'
]

function coerce(value) {
  if (!isNaN(parseInt(value, 10)) && isFinite(value)) {
    // value is numeric
    if (value < 10) value = 10
    if (value > 60) value = 60
  }
  else if (LEVELS.indexOf(value) === -1) {
    value = 'info'
  }

  return value
}

// can't use shimmer here because shimmer depends on logger
var _level = Logger.prototype.level
Logger.prototype.level = function validatingLevel(value) {
  return _level.call(this, coerce(value))
}

options = {
  name   : 'newrelic_bootstrap',
  stream : process.stdout,
  level  : 'info'
}

// create bootstrapping logger
module.exports = new Logger(options)


/**
 * Don't load config.js until this point, because it requires this
 * module, and if it gets loaded too early, module.exports will have no
 * value.
 */
var config = require('./config.js').initialize()
options = {
  name    : 'newrelic',
  streams : [{level : coerce(config.logging.level)}]
}

switch (config.logging.filepath) {
  case 'stdout':
    options.streams[0].stream = process.stdout
  break

  case 'stderr':
    options.streams[0].stream = process.stderr
  break

  default:
    options.streams[0].path = config.logging.filepath
}

// create the "real" logger
module.exports = new Logger(options)

// now tell the config module to switch to the real logger
config.setLogger(module.exports)
