'use strict';

var util         = require('util')
  , path         = require('path')
  , fs           = require('fs')
  , EventEmitter = require('events').EventEmitter
  , Metrics      = require(path.join(__dirname, 'metrics'))
  ;

var DEFAULT_CONFIG = require(path.join(__dirname, 'config.default'));

function merge(defaults, config) {
  Object.keys(defaults).forEach(function (name) {
    if (config[name] !== undefined) {
      if (Array.isArray(config[name])) {
        // use the value in config
      }
      else if (typeof(defaults[name]) === 'object') {
        merge(defaults[name], config[name]);
      }
      // else use the value in config
    }
    else {
      config[name] = defaults[name];
    }
  });
}

function setDefaults(config) {
  merge(DEFAULT_CONFIG, config);
}

function parseVersion() {
  var text = fs.readFileSync(path.join(__dirname, '..', 'package.json'));
  var json = JSON.parse(text);

  return json.version;
}

function Config(config) {
  EventEmitter.call(this);

  for (var name in config) if (config.hasOwnProperty(name)) this[name] = config[name];

  this.version = parseVersion();

  if (this.debug.internal_metrics) {
    this.debug.supportability = new Metrics(this.apdex_t);
  }
}
util.inherits(Config, EventEmitter);

Config.prototype.onConnect = function (params) {
  this.apdex_t = params.apdex_t;

  this.emit('change', this);
};

Config.prototype.applications = function () {
  var apps = this.app_name;

  if (apps && typeof(apps) === 'string') {
    return [apps];
  }
  else {
    return apps;
  }
};

Config.prototype.measureInternal = function (suffix, duration) {
  if (this.debug.supportability) {
      var internal = this.debug.supportability;
      var metric = internal.getOrCreateMetric('Supportability/' + suffix);
      metric.stats.recordValueInMillis(duration);
  }
};

function initialize(logger, c) {
  var NEWRELIC_HOME    = process.env.NEWRELIC_HOME
    , DEFAULT_FILENAME = 'newrelic.js'
    , config
    ;

  if (typeof(c) === 'object') {
    config = c;
  }
  else {
    var filepath;
    if (NEWRELIC_HOME) {
      filepath = path.join(NEWRELIC_HOME, DEFAULT_FILENAME);
    }
    else {
      filepath = path.join(process.cwd(), DEFAULT_FILENAME);
    }

    try {
      config = require(filepath);
    }
    catch (error) {
      throw new Error("Unable to find configuration file '" + filepath +
                      "'. A default configuration file can be copied from '" +
                      path.join(__dirname, 'config.default.js') + "' and renamed to 'newrelic.js' " +
                      "in the directory from which you'll be running your app.");
    }

    logger.debug("Using configuration file %s.", filepath);
  }

  setDefaults(config);

  config = config.config;
  if (NEWRELIC_HOME) config.newrelic_home = NEWRELIC_HOME;

  return new Config(config);
}

exports.initialize = initialize;
