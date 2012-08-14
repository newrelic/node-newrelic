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

  var reconnectAttempt = function (error) {
    logger.error("An error occurred connecting to " + self.config.host + ":" + self.config.port + " - " + error);
    self.connect();
  };

  var collectorSetup = function collectorSetup() {
    if (self.connection) return;

    // Allow the connection to be mocked externally
    self.connection = self.options.connection || new CollectorConnection(self);

    // add listeners
    self.connection.on('connect',            self.config.onConnect.bind(self.config));
    self.connection.on('connect',            self.metricNormalizer.parseMetricRules.bind(self.metricNormalizer));
    self.connection.on('metricDataError',    self.statsEngine.mergeMetricData.bind(self.statsEngine));
    self.connection.on('metricDataResponse', self.statsEngine.parseMetricIds.bind(self.statsEngine));
    self.connection.on('errorDataError',     self.errors.onSendError.bind(self.errors));
    self.connection.on('connectError',       function (error) {
      setTimeout(function () { reconnectAttempt(error); }, 15 * 1000);
    });

    self.connection.connect();

    self.emit('connect');
  };

  this.on('connectReady', collectorSetup.bind(this));
  this.config.on('change', this.statsEngine.onConnect.bind(this.statsEngine));
}
util.inherits(Agent, events.EventEmitter);

Agent.prototype.connect = function connect() {
  if (!this.applicationPort) {
    logger.debug("no applicationPort set, waiting to connect");
    setTimeout(function () { this.emit('connectReady'); }, 15 * 1000);
  }
  else {
    this.emit('connectReady');
  }
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

Agent.prototype.start = function () {
  if (this.config.agent_enabled !== true) {
    return logger.warn('The New Relic Node.js agent is disabled in config.js. Not starting!');
  }

  logger.info("Starting the New Relic node.js agent");

  this.harvestIntervalId = setInterval(this.harvest.bind(this), 60 * 1000);
  sampler.start(this.statsEngine);

  this.connect();
};

Agent.prototype.stop = function () {
  logger.info('Stopping the New Relic node.js agent');

  if (this.harvestIntervalId) clearInterval(this.harvestIntervalId);

  sampler.stop();
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
