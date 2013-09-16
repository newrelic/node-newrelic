'use strict';

var path   = require('path')
  , Logger = require('bunyan')
  ;

var LEVELS = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal'
];

var logger;
function getCurrent() {
  return logger;
}

function coerce(value) {
  if (!isNaN(parseInt(value, 10)) && isFinite(value)) {
    // value is numeric
    if (value < 10) value = 10;
    if (value > 60) value = 60;
  }
  else if (LEVELS.indexOf(value) === -1) {
    value = 'info';
  }

  return value;
}

// create bootstrapping logger
logger = new Logger({
  name   : 'newrelic',
  stream : process.stdout,
  level  : 'info'
});
logger.getCurrent = getCurrent;

module.exports = logger;

/* Don't load the configuration module until here, because it requires this
 * module, and if it gets loaded too soon it will have the empty module.exports
 * as its logger.
 */
var config = require(path.join(__dirname,
                               'config.js')).initialize(module.exports);

var options = {
  name    : 'newrelic',
  streams : [{level : coerce(config.logging.level)}]
};

switch (config.logging.filepath) {
  case 'stdout':
    options.streams[0].stream = process.stdout;
  break;

  case 'stderr':
    options.streams[0].stream = process.stderr;
  break;

  default:
    options.streams[0].path = config.logging.filepath;
}

// create the "real" logger
logger = new Logger(options);
logger.getCurrent = getCurrent;

// can't use shimmer here because shimmer depends on logger
var _level = logger.level;
logger.level = function validatingLevel(value) {
  return _level.call(this, coerce(value));
};

// now tell the config module to refresh which logger it's using
config.refreshLogger();

module.exports = logger;
