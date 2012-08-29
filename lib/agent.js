'use strict';

var path                = require('path')
  , events              = require('events')
  , util                = require('util')
  , trace               = require(path.join(__dirname, 'legacy', 'trace'))
  , transaction         = require(path.join(__dirname, 'transaction', 'manager'))
  , logger              = require(path.join(__dirname, 'logger'))
  , sampler             = require(path.join(__dirname, 'sampler'))
  , CollectorConnection = require(path.join(__dirname, 'collector', 'connection'))
  , ErrorService        = require(path.join(__dirname, 'error'))
  , Metrics             = require(path.join(__dirname, 'metrics'))
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

  this.errors  = new ErrorService(this.config);
  this.metrics = new Metrics(this.config.apdex_t);

  this.on('connectReady',        this.collectorSetup.bind(this));
  this.on('transactionFinished', this.mergeMetrics.bind(this));
  this.config.on('change',       this.updateApdexThreshold.bind(this));
}
util.inherits(Agent, events.EventEmitter);

Agent.prototype.start = function () {
  if (this.config.agent_enabled !== true) {
    return logger.warn("The New Relic Node.js agent is disabled in config.js. Not starting!");
  }

  logger.info("Starting New Relic Node.js instrumentation.");

  this.harvestIntervalId = setInterval(this.harvest.bind(this), 60 * 1000);
  sampler.start(this);

  this.connect();
};

Agent.prototype.stop = function () {
  logger.info("Stopping New Relic Node.js instrumentation");

  // stop the harvester coroutine
  if (this.harvestIntervalId) clearInterval(this.harvestIntervalId);

  // shut down the sampler (and its own coroutines)
  sampler.stop();
};

/**
 * Trigger the listener registered on 'connectReady' in the constructor, but
 * wait a little while if the instrumentation hasn't noticed an application
 * port yet.
 */
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

/**
 * Update the apdex tolerating threshold.
 *
 * Needs to be bound to the agent, because the agent manages the creation
 * and destruction of the metrics object as part of the harvest cycle.
 */
Agent.prototype.updateApdexThreshold = function (params) {
  this.metrics.updateApdexT(params);
};

/**
 * Reset the normalizer rules for metrics.
 *
 * Needs to be bound to the agent, because the agent manages the creation
 * and destruction of the metrics object as part of the harvest cycle.
 */
Agent.prototype.updateNormalizerRules = function (response) {
  this.metrics.normalizer.parseMetricRules(response);
};

/**
 * Update the metric renaming rules.
 *
 * Needs to be bound to the agent, because the agent manages the creation
 * and destruction of the metrics object as part of the harvest cycle.
 */
Agent.prototype.updateRenameRules = function (metricIDs) {
  this.metrics.updateRenameRules(metricIDs);
};

/**
 * Handle errors connecting to the collector by attempting to retry the connection.
 *
 * FIXME: should probably give up after a while if it can't connect.
 */
Agent.prototype.scheduleRetry = function (error) {
  var self = this;

  logger.error("An error occurred connecting to " + self.config.host + ":" + self.config.port + " - " + error);
  logger.error("Next attempting to connect to collector in 15 seconds.");
  setTimeout(function () { self.connect(); }, 15 * 1000);
};

Agent.prototype.collectorSetup = function () {
  if (this.connection) return;

  // Allow the connection to be mocked externally
  this.connection = this.options.connection || new CollectorConnection(this);

  // add listeners
  this.connection.on('connect',            this.config.onConnect.bind(this.config));
  this.connection.on('connect',            this.updateNormalizerRules.bind(this));
  this.connection.on('metricDataResponse', this.updateRenameRules.bind(this));
  this.connection.on('metricDataError',    this.mergeMetrics.bind(this));
  this.connection.on('errorDataError',     this.errors.onSendError.bind(this.errors));
  this.connection.on('connectError',       this.scheduleRetry.bind(this));

  this.connection.connect();

  this.emit('connect');
};

Agent.prototype.harvest = function () {
  if (this.connection && this.connection.isConnected()) {
    // coalesce and reset the state of the error tracker
    this.metrics.getOrCreateMetric('Errors/all').stats.incrementCallCount(this.errors.errorCount);
    this.connection.sendTracedErrors(this.errors.errors);
    this.errors.clear();

    // coalesce and reset the state of the gathered metrics
    var metrics  = this.metrics;
    this.metrics = new Metrics(metrics.apdexT, metrics.renamer, metrics.normalizer);

    // push that thar data to the collector
    this.connection.sendMetricData(metrics.lastSendTime / 1000, Date.now() / 1000, metrics);
  }
};

/**
 * Need to have a level of indirection between the event handler and the
 * metrics property to ensure that we're using the current metrics object
 * and am not holding a reference to the very first metrics object created
 * upon instantiation.
 */
Agent.prototype.mergeMetrics = function (metrics) {
  this.metrics.merge(metrics);
};

Agent.prototype.noticeAppPort = function (port) {
  logger.debug("Noticed application running on port " + port);
  this.applicationPort = port;
  this.emit('connectReady');
};

Agent.prototype.createTransaction = function (height) {
  return this.transaction = trace.createTransaction(this, height);
};

Agent.prototype.getTransaction = function () {
  if (this.transaction) {
    if (this.transaction.finished) {
      delete this.transaction;
    }
    else {
      return this.transaction;
    }
  }

  var stashed = transaction.find(this);
  if (stashed && stashed.isActive()) return stashed;
};

Agent.prototype.setTransaction = function (transaction) {
  if (!(transaction && transaction.finished)) this.transaction = transaction;
};

Agent.prototype.clearTransaction = function (transaction) {
  if (this.transaction === transaction) {
    logger.verbose('clearing transaction');
    this.transaction = null;
  }
};

module.exports = Agent;
