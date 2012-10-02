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
  'fatal',
];

var logger = new Logger({
  name    : 'newrelic',
  streams : [{
    level : 'trace',
    name  : 'file',
    path  : path.join(process.cwd(), 'newrelic_agent.log')
  }]
});

// can't use shimmer here because of the circular dependency this would create
var level = logger.level;
logger.level = function validatingLevel(value) {
  // value is numeric
  if (!isNaN(parseInt(value, 10)) && isFinite(value)) {
    if (value < 10) value = 10;
    if (value > 60) value = 60;
  }
  // value is stringular
  else {
    if (LEVELS.indexOf(value) === -1) value = 'trace';
  }

  return level.call(logger, value);
};

module.exports = logger;
