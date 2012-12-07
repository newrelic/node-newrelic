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

/*
 * So we can get the logfile location, we need to duplicate some of the
 * configurator's logic.
 */
var NEWRELIC_HOME    = process.env.NEWRELIC_HOME
  , DEFAULT_FILENAME = 'newrelic.js'
  , configpath
  , config
  ;

if (NEWRELIC_HOME) {
  configpath = path.join(NEWRELIC_HOME, DEFAULT_FILENAME);
}
else {
  configpath = path.join(process.cwd(), DEFAULT_FILENAME);
}

try {
  config = require(configpath).config;
}
catch (e) {
  console.error("Unable to load New Relic agent configuration to start logger:",
                e.stack);
}

var filepath;
// default config is empty string, which is falsy
if (config && config.logging && config.logging.filepath) {
  filepath = config.logging.filepath;
}
else {
  filepath = path.join(process.cwd(), 'newrelic_agent.log');
}

var logger = new Logger({
  name    : 'newrelic',
  streams : [{
    level : 'trace',
    name  : 'file',
    path  : filepath
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
