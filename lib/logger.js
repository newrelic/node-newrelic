'use strict';

var path   = require('path')
  , Logger = require('bunyan')
  , Config = require(path.join(__dirname, 'config'))
  ;

var LEVELS = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal'
];

function validate(value) {
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

function bootstrap(config) {
  var options = {
    name    : 'newrelic',
    streams : [{level : validate(config.logging.level)}]
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

  var logger = new Logger(options);

  // can't use shimmer here because of the circular dependency this would create
  var _level = logger.level;
  logger.level = function validatingLevel(value) {
    return _level.call(this, validate(value));
  };

  return logger;
}

module.exports = bootstrap(Config.initialize());
