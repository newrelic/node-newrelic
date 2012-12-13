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
  'fatal',
];

/*
 * So we can get the logfile location, we need to duplicate some of the
 * configurator's logic.
 */
var DEFAULT_FILENAME = 'newrelic.js'
  , configpath = path.join(process.env.NEW_RELIC_HOME || process.cwd(),
                           DEFAULT_FILENAME)
  , config
  , level = 'info'
  ;

try {
  config = new Config(require(configpath).config);
  if (config && config.logging && config.logging.level) level = config.logging.level;
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

var options = {
  name : 'newrelic',
  streams : [{level  : level}]
};

if (filepath === 'stdout') {
  options.streams[0].stream = process.stdout;
}
else if (filepath === 'stderr') {
  options.streams[0].stream = process.stderr;
}
else {
  options.streams[0].path = filepath;
}

var logger = new Logger(options);

// can't use shimmer here because of the circular dependency this would create
var _level = logger.level;
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

  return _level.call(this, value);
};

module.exports = logger;
