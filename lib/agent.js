'use strict';

var path                = require('path')
  , util                = require('util')
  , EventEmitter        = require('events').EventEmitter
  , logger              = require(path.join(__dirname, 'logger'))
  , sampler             = require(path.join(__dirname, 'sampler'))
  , CollectorConnection = require(path.join(__dirname, 'collector', 'connection'))
  , Context             = require(path.join(__dirname, 'context'))
  , ErrorService        = require(path.join(__dirname, 'error'))
  , Metrics             = require(path.join(__dirname, 'metrics'))
  , MetricNormalizer    = require(path.join(__dirname, 'metrics', 'normalizer'))
  , RenameRules         = require(path.join(__dirname, 'metrics', 'rename-rules'))
  , TraceAggregator     = require(path.join(__dirname, 'transaction', 'trace', 'aggregator'))
  , Tracer              = require(path.join(__dirname, 'transaction', 'tracer', 'debug'))
  , Transaction         = require(path.join(__dirname, 'transaction'))
  ;

function Agent(options) {
  EventEmitter.call(this);

  this.options     = options || {};
  this.environment = require(path.join(__dirname, 'environment'));

  // the agent doesn't do anything interesting without a configuration available

  // If configuration is passed in via the options object, use it.
  // (mostly for testing)
  if (!this.options.config) {
    this.config = require(path.join(__dirname, 'config')).initialize(logger);
  }
  else {
    this.config = options.config;
  }

  this.config.on('change', this.updateApdexThreshold.bind(this));
  logger.level(this.config.log_level || 'info');

  this.version = this.config.version;
  this.errors  = new ErrorService(this.config);

  this.apdexT     = (this.config.apdex_t || 0);
  this.renamer    = new RenameRules();
  this.normalizer = new MetricNormalizer();
  this.metrics    = new Metrics(this.apdexT, this.renamer, this.normalizer);

  var Tracer;
  if (this.config.debug.tracer_tracing) {
    this.context = new Context(true);
    Tracer = require(path.join(__dirname, 'transaction', 'tracer', 'debug'));
    this.tracer  = new Tracer(this, this.context);
    this.on('transactionFinished', this.logInternalTrace);
  }
  else {
    this.context = new Context();
    Tracer = require(path.join(__dirname, 'transaction', 'tracer'));
    this.tracer  = new Tracer(this, this.context);
  }

  this.traces  = new TraceAggregator(this.config);
  this.traces.on('harvest', this.submitTransactionSampleData.bind(this));

  this.on('connectReady',        this.collectorSetup.bind(this));
  this.on('transactionFinished', this.mergeTransaction.bind(this));
  this.on('transactionFinished', this.errors.onTransactionFinished.bind(this.errors));
  this.on('transactionFinished', this.traces.add.bind(this.traces));
}
util.inherits(Agent, EventEmitter);

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
 */
Agent.prototype.updateApdexThreshold = function (params) {
  if (!params) logger.warn('Unable to update apdex tolerating value: no params.');

  if ((params.apdex_t || params.apdex_t === 0) &&
      params.apdex_t !== this.apdexT) {
    logger.info("Apdex tolerating value changed from %d to %d.", this.apdexT, params.apdex_t);
    this.apdexT = params.apdex_t;
    this.metrics.apdexT = params.apdex_t;
  }
};

/**
 * Reset the normalizer rules for metrics.
 *
 * Needs to be bound to the agent, because the agent manages the creation
 * and destruction of the metrics object as part of the harvest cycle.
 */
Agent.prototype.updateNormalizerRules = function (response) {
  this.normalizer.parseMetricRules(response);
};

/**
 * Update the metric renaming rules.
 */
Agent.prototype.updateRenameRules = function (metricIDs) {
  if (!metricIDs) logger.warn('Unable to update metric renaming rules: no new rules passed in.');

  this.renamer.parse(metricIDs);
};

/**
 * Handle errors connecting to the collector by attempting to retry the connection.
 *
 * FIXME: should probably give up after a while if it can't connect.
 */
Agent.prototype.scheduleRetry = function (error) {
  logger.error(error, "(This error occurred while connecting to %s:%d.)",
               this.config.host,
               this.config.port);
  logger.error("Next attempting to connect to collector in 15 seconds.");
  setTimeout(this.connect.bind(this), 15 * 1000);
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
    this.submitErrorData();
    this.submitMetricData();
    this.traces.harvest();
  }
};

/**
 * coalesce and reset the state of the error tracker
 */
Agent.prototype.submitErrorData = function () {
  this.metrics.getOrCreateMetric('Errors/all').stats.incrementCallCount(this.errors.errorCount);
  this.connection.sendTracedErrors(this.errors.errors);
  this.errors.clear();
};

/**
 * coalesce and reset the state of the gathered metrics
 */
Agent.prototype.submitMetricData = function () {
    var metrics  = this.metrics;
    if (this.config.debug.supportability) metrics.merge(this.config.debug.supportability);
    this.metrics = new Metrics(this.apdexT, this.renamer, this.normalizer);

    // push that thar data to the collector
    this.connection.sendMetricData(metrics.lastSendTime / 1000, Date.now() / 1000, metrics);
};

/**
 * When a harvested transaction trace shows up, send it along to be submitted.
 */
Agent.prototype.submitTransactionSampleData = function (encoded) {
  this.connection.sendTransactionTraces([encoded]);
};

/**
 * The error tracer and transaction tracer expect the full transaction,
 * but the metrics gatherer only wants to merge metrics objects.
 *
 * @param {Transaction} transaction A finished transaction.
 */
Agent.prototype.mergeTransaction = function (transaction) {
  this.mergeMetrics(transaction.metrics);
};

/**
 * Need to have a level of indirection between the event handler and the
 * metrics property to ensure that we're using the current metrics object
 * and am not holding a reference to the very first metrics object created
 * upon instantiation.
 */
Agent.prototype.mergeMetrics = function (metrics) {
  this.metrics.merge(metrics);
  this.emit('metricsMerged');
};

Agent.prototype.noticeAppPort = function (port) {
  logger.debug("Noticed application running on port %d.", port);
  this.applicationPort = port;
  this.emit('connectReady');
};

/**
 * Create a new transaction bound to this agent, and attach the transaction
 * to the calling context.
 *
 * @param {Number} height How far up the call stack to attach the transaction.
 * @returns {Transaction} Newly-created, bound transaction.
 */
Agent.prototype.createTransaction = function () {
  return new Transaction(this);
};

/**
 * Primary interface to the shared state / domains for the instrumentation.
 */
Agent.prototype.getState = function () {
  return this.context.state;
};

/**
 * Examine shared context to find any current transaction.
 * Filter out inactive transactions.
 *
 * @returns {Transaction} The current transaction.
 */
Agent.prototype.getTransaction = function () {
  var state = this.getState();
  if (state) {
    var transaction = state.getTransaction();
    if (transaction && transaction.isActive()) return transaction;
  }
};

/**
 * Only used when tracer tracing is enabled. Dumps a representation of the
 * internal state of the tracer for a given transaction; only really useful
 * to agent developers.
 */
Agent.prototype.logInternalTrace = function (transaction) {
  if (transaction.state && transaction.state.describer) {
    logger.trace({trace_dump : transaction.state.describer.verbose},
                 "Dumped transaction state.");
  }
};

module.exports = Agent;
