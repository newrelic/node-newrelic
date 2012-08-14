'use strict';

var path                = require('path')
  , events              = require('events')
  , util                = require('util')
  , trace               = require(path.join(__dirname, 'trace'))
  , logger              = require(path.join(__dirname, 'logger'))
  , sampler             = require(path.join(__dirname, 'sampler'))
  , CollectorConnection = require(path.join(__dirname, 'collector', 'connection'))
  , ErrorService        = require(path.join(__dirname, 'error'))
  , MetricNormalizer    = require(path.join(__dirname, 'metric', 'normalizer'))
  , StatsEngine         = require(path.join(__dirname, 'stats', 'engine'))
  ;

function noop() {}

function Agent(options) {
  events.EventEmitter.call(this);

  var self = this;

  try {
    this.config = require(path.join(__dirname, 'config')).initialize(logger);
  }
  catch (e) {
    logger.error(e);
    this.start = function () { return false; };
    this.stop = noop;
    return false;
  }

  logger.level = this.config.log_level || 'info';

  this.options     = options || {};
  this.environment = require(path.join(__dirname, 'environment'));
  this.version     = this.config.version;

  this.metricNormalizer = new MetricNormalizer(logger);
  this.errors           = new ErrorService(logger, this.config);
  this.statsEngine      = new StatsEngine();

  this.on('connectReady', this.collectorSetup.bind(this));
  this.config.on('change', this.statsEngine.onConnect.bind(this.statsEngine));
}
util.inherits(Agent, events.EventEmitter);

Agent.prototype.start = function () {
  if (this.config.agent_enabled !== true) {
    return logger.warn("The New Relic Node.js agent is disabled in config.js. Not starting!");
  }

  logger.info("Starting New Relic Node.js instrumentation.");

  this.harvestIntervalId = setInterval(this.harvest.bind(this), 60 * 1000);
  sampler.start(this.statsEngine);

  this.connect();
};

Agent.prototype.stop = function () {
  logger.info("Stopping New Relic Node.js instrumentation");

  if (this.harvestIntervalId) clearInterval(this.harvestIntervalId);

  sampler.stop();
};

Agent.prototype.connect = function () {
  var self = this;

  if (!this.applicationPort) {
    logger.debug("No applicationPort set, waiting 15 seconds to try again.");
    setTimeout(function () { self.emit('connectReady'); }, 15 * 1000);
  }
  else {
    this.emit('connectReady');
  }
};

Agent.prototype.collectorSetup = function () {
  if (this.connection) return;

  var self = this;

  var reconnectAttempt = function (error) {
    logger.error("An error occurred connecting to " + self.config.host + ":" + self.config.port + " - " + error);
    self.connect();
  };

  // Allow the connection to be mocked externally
  this.connection = this.options.connection || new CollectorConnection(this);

  // add listeners
  this.connection.on('connect',            this.config.onConnect.bind(this.config));
  this.connection.on('connect',            this.metricNormalizer.parseMetricRules.bind(this.metricNormalizer));
  this.connection.on('metricDataError',    this.statsEngine.mergeMetricData.bind(this.statsEngine));
  this.connection.on('metricDataResponse', this.statsEngine.parseMetricIds.bind(this.statsEngine));
  this.connection.on('errorDataError',     this.errors.onSendError.bind(this.errors));
  this.connection.on('connectError',       function (error) {
    setTimeout(function () { reconnectAttempt(error); }, 15 * 1000);
  });

  this.connection.connect();

  this.emit('connect');
};

Agent.prototype.harvest = function () {
  if (this.connection && this.connection.isConnected()) {
    // coalesce and reset the state of the error tracker
    var allErrors = this.statsEngine.unscopedStats.byName("Errors/all");
    allErrors.incrementCallCount(this.errors.errorCount);
    this.connection.sendTracedErrors(this.errors.errors);
    this.errors.clear();

    // coalesce and reset the state of the gathered metrics
    var md = this.statsEngine.getMetricData();
    this.statsEngine.clear();

    // push that thar data to the collector
    // FIXME: should have a concept of recovery upon failure as part of this function
    this.connection.sendMetricData(this.statsEngine.lastSendTime / 1000, Date.now() / 1000, md);
  }
};

Agent.prototype.noticeAppPort = function (port) {
  logger.debug("Noticed application running on port " + port);
  this.applicationPort = port;
  this.emit('connectReady');
};

Agent.prototype.createTransaction = function () {
  return this.transaction = trace.createTransaction(this);
};

Agent.prototype.getTransaction = function () {
  if (this.transaction) {
    if (this.transaction.finished) {
      this.transaction = null;
    }

    return this.transaction;
  }
  return null;
};

Agent.prototype.setTransaction = function (transaction) {
  if (!(transaction && transaction.finished)) {
    this.transaction = transaction;
  }
};

Agent.prototype.clearTransaction = function (transaction) {
  if (this.transaction === transaction) {
    logger.debug('clearing transaction');
    this.transaction = null;
  }
};

Agent.prototype.incrementCounter = function (metricName) {
  this.statsEngine.unscopedStats.byName(metricName).incrementCallCount();
};

module.exports = Agent;
