'use strict';

var path                = require('path')
  , util                = require('util')
  , EventEmitter        = require('events').EventEmitter
  , logger              = require(path.join(__dirname, 'logger'))
  , sampler             = require(path.join(__dirname, 'sampler'))
  , CollectorConnection = require(path.join(__dirname, 'collector', 'connection'))
  , Context             = require(path.join(__dirname, 'context'))
  , ErrorTracer         = require(path.join(__dirname, 'error'))
  , Metrics             = require(path.join(__dirname, 'metrics'))
  , MetricNormalizer    = require(path.join(__dirname, 'metrics', 'normalizer'))
  , RenameRules         = require(path.join(__dirname, 'metrics', 'rename-rules'))
  , TraceAggregator     = require(path.join(__dirname, 'transaction',
                                            'trace', 'aggregator'))
  , Transaction         = require(path.join(__dirname, 'transaction'))
  ;

/*
 *
 * CONSTANTS
 *
 */

// taken directly from Python agent's newrelic.core.application
var BACKOFFS = [
  {interval :  15, warn : false, error : false},
  {interval :  15, warn : false, error : false},
  {interval :  30, warn : false, error : false},
  {interval :  60, warn :  true, error : false},
  {interval : 120, warn : false, error : false},
  {interval : 300, warn : false, error :  true}
];

/**
 * There's a lot of stuff in this constructor, due to Agent acting as the
 * orchestrator for New Relic within instrumented applications.
 *
 * This constructor can throw if, for some reason, the configuration isn't
 * available. Don't try to recover here, because without configuration the
 * agent can't be brought up to a useful state.
 */
function Agent(options) {
  EventEmitter.call(this);

  // For testing, accept an options object to override bits of agent config.
  this.options = options || {};
  if (!this.options.config) {
    this.config = require(path.join(__dirname, 'config')).initialize(logger);
  }
  else {
    this.config = this.options.config;
  }
  // FIXME: should accept all changes from server-side configuration, not just apdexT
  this.config.on('change', this.onApdexTChange.bind(this));
  logger.level((this.config.logging && this.config.logging.level) || 'info');

  this.environment = require(path.join(__dirname, 'environment'));
  this.version     = this.config.version;

  // error tracing
  this.errors = new ErrorTracer(this.config);

  // metrics
  this.apdexT     = this.config.apdex_t;
  this.renamer    = new RenameRules();
  this.normalizer = new MetricNormalizer();
  this.metrics    = new Metrics(this.apdexT, this.renamer, this.normalizer);
  if (this.config.debug.internal_metrics) {
    this.config.debug.supportability = new Metrics(this.apdexT);
  }

  // transaction traces
  this.tracer = this.setupTracer(this.config);
  this.traces = new TraceAggregator(this.config);
  this.traces.on('harvest', this.submitTransactionSampleData.bind(this));

  // agent events
  this.on('ready',               this._connect.bind(this));
  this.on('transactionFinished', this.mergeTransaction.bind(this));
  this.on('transactionFinished', this.errors.onTransactionFinished.bind(this.errors));
  this.on('transactionFinished', this.traces.add.bind(this.traces));
  this.on('restart',             this.restart.bind(this));
  this.on('shutdown',            this.stop.bind(this));
}
util.inherits(Agent, EventEmitter);

/**
 * The agent is meant to only exist once per application, but the singleton is
 * managed by index.js. An agent will be created even if the agent's disabled by
 * the configuration.
 *
 * @config agent_enabled (true|false) Whether to start up the agent.
 */
Agent.prototype.start = function () {
  if (this.config.agent_enabled !== true) {
    return logger.warn("The New Relic Node.js agent is disabled by its configuration. " +
                       "Not starting!");
  }

  if (!(this.config.license_key)) {
    logger.error("A valid account license key cannot be found. " +
                 "Has a license key been specified in the agent configuration " +
                 "file or via the NEW_RELIC_LICENSE_KEY environment variable?");
    return logger.error("Not starting without license key!");
  }

  logger.info("Starting New Relic Node.js instrumentation.");

  this.setupConnection();

  sampler.start(this);
  this.harvesterHandle = setInterval(this.harvest.bind(this), 60 * 1000);

  this.emit('ready');
};

/**
 * Any memory claimed by the agent will be retained after stopping.
 *
 * FIXME: make it possible to dispose of the agent, as well as do a
 * "hard" restart. This requires working with shimmer to strip the
 * current instrumentation and patch to the module loader.
 */
Agent.prototype.stop = function () {
  if (this.harvesterHandle) clearInterval(this.harvesterHandle);
  sampler.stop();

  if (this.connection) {
    this.connection.end();
    delete this.connectionFailures;
    delete this.connection;
  }

  logger.info("New Relic Node.js instrumentation stopped.");
};

Agent.prototype.restart = function () {
  logger.info("Resetting the agent's connection to New Relic.");

  this.stop();
  this.start();
};

Agent.prototype.onApdexTChange = function (params) {
  if (!params) logger.warn('Unable to update apdex tolerating value: no params.');

  if (params.apdex_t !== this.apdexT && params.apdex_t >= 0) {
    logger.info("Apdex tolerating value changed from %s to %s.",
                this.apdexT,
                params.apdex_t);
    this.apdexT = params.apdex_t;
    this.metrics.apdexT = params.apdex_t;
  }
};

/**
 * Needs to be bound to the agent, because the agent manages the creation
 * and destruction of the metrics object as part of the harvest cycle.
 */
Agent.prototype.onNewNormalizationRules = function (response) {
  this.normalizer.load(response);
};

Agent.prototype.onNewRenameRules = function (rules) {
  this.renamer.load(rules);
};

/**
 * Ensure that events flow correctly from the collector to the agent by wiring
 * events emitted by the connection to the correct pieces of the agent. The
 * connection is dependent on the agent, but only for configuration. As much
 * as possible, it should remain standalone.
 *
 * Events with names ending 'Error' or 'Response' are dynamically generated by
 * the connection, based on the API method invoked on the collector.
 */
Agent.prototype.setupConnection = function () {
  if (this.connection) return;

  // allow the connection to be mocked
  this.connection = this.options.connection || new CollectorConnection(this);

  this.connection.on('connect',            this.config.onConnect.bind(this.config));
  this.connection.on('connect',            this.onNewNormalizationRules.bind(this));
  this.connection.on('connect',            this.emit.bind(this, 'connected'));
  this.connection.on('metricDataResponse', this.onNewRenameRules.bind(this));
  this.connection.on('metricDataError',    this.mergeMetrics.bind(this));
  this.connection.on('errorDataError',     this.errors.onSendError.bind(this.errors));

  this.connectionFailures = 0;
  this.connection.once('connectError', this._failAndRetry.bind(this));
};

/**
 * Should only be called indirectly via events.
 */
Agent.prototype._connect = function () {
  this.connection.connect();
  this.emit('connect');
};

Agent.prototype._failAndRetry = function (data, error) {
  if (error) {
    logger.error(error,
                 "On attempting to connect to %s:%d, got error:",
                 this.config.host,
                 this.config.port);
  }

  this.connectionFailures += 1;

  var backoff = this.nextBackoff();
  if (backoff.warn) {
    logger.warn("The agent hasn't connected to the collector after %s attempts.",
                this.connectionFailures);
  }

  logger.info("Next attempting to connect to collector in %s seconds.", backoff);
  setTimeout(this._nextConnectAttempt.bind(this, backoff.error),
             backoff.interval * 1000);
};

Agent.prototype._nextConnectAttempt = function (backoff) {
  if (backoff.error) {
    this.connection.once('connectError', this._failAndShutdown.bind(this));
  }
  else {
    this.connection.once('connectError', this._failAndRetry.bind(this));
  }

  this.emit('ready');
};

Agent.prototype._failAndShutdown = function (data, error) {
  if (error) {
    logger.error(error,
                 "On final connection attempt to %s:%d, got error:",
                 this.config.host,
                 this.config.port);
  }

  logger.error("Unable to connect to New Relic after %s attempts.",
               this.connectionFailures + 1);
  logger.error("Giving up and shutting down the agent!");

  this.stop();
};

Agent.prototype.nextBackoff = function () {
  var failures = this.connectionFailures
    , current  = Math.min(Math.max(failures || 0, 1), BACKOFFS.length) - 1
    ;

  return BACKOFFS[current];
};

/**
 * To develop the current transaction tracer, I created a tracing tracer that
 * tracks when transactions, segments and function calls are proxied. This is
 * used by the tests, but can also be dumped and logged, and is useful for
 * figuring out where in the execution chain tracing is breaking down.
 *
 * @param object config Agent configuration.
 *
 * @returns Tracer Either a debugging or production transaction tracer.
 */
Agent.prototype.setupTracer = function (config) {
  var Tracer;
  if (config && config.debug && config.debug.tracer_tracing) {
    this.context = new Context(true);
    Tracer = require(path.join(__dirname, 'transaction', 'tracer', 'debug'));
    this.on('transactionFinished', this.logInternalTrace);
  }
  else {
    this.context = new Context();
    Tracer = require(path.join(__dirname, 'transaction', 'tracer'));
  }

  return new Tracer(this, this.context);
};

/**
 * On agent startup, an interval timer is started that calls this method once
 * a minute, which in turn invokes the pieces of the harvest cycle.
 */
Agent.prototype.harvest = function () {
  if (this.connection && this.connection.isConnected()) {
    this.submitErrorData();
    this.submitMetricData();
    this.traces.harvest();
  }
};

/**
 * For historical reasons, the error handler is reused across harvest cycles
 * instead of being reused.
 */
Agent.prototype.submitErrorData = function () {
  this.metrics.getOrCreateMetric('Errors/all')
    .stats.incrementCallCount(this.errors.errorCount);
  this.metrics.getOrCreateMetric('Errors/allWeb')
    .stats.incrementCallCount(this.errors.errorCount);
  this.connection.sendTracedErrors(this.errors.errors);
  this.errors.clear();
};

/**
 * The pieces of supportability metrics are scattered all over the place -- only
 * send supportability mnetrics if they're explicitly enabled in the
 * configuration.
 */
Agent.prototype.submitMetricData = function () {
    var metrics  = this.metrics;
    if (this.config.debug.supportability) {
      metrics.merge(this.config.debug.supportability);
    }
    this.metrics = new Metrics(this.apdexT, this.renamer, this.normalizer);

    this.connection.sendMetricData(metrics.lastSendTime / 1000,
                                   Date.now() / 1000,
                                   metrics);
};

/**
 * The connection methods are written generically, so they expect arrays, even
 * though top N transaction logic dictates that only one transaction will be
 * sent per harvest cycle.
 *
 * TODO: remove need to wrap trace up in another array.
 *
 * @param Array encoded JSON array with encoded contents to be submitted.
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
 *
 * @param Metrics metrics The failed metrics submission to be aggregated into
 *                        the current Metrics instance.
 */
Agent.prototype.mergeMetrics = function (metrics, error) {
  if (error) logger.warn(error, "Merging metrics from last harvest cycle because:");

  this.metrics.merge(metrics);
  this.emit('metricsMerged');
};

/**
 * Create a new transaction bound to this agent, and attach the transaction
 * to the calling context.
 *
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
 *
 * @param Transaction transaction Transaction with a debugging transaction
 *                                trace.
 */
Agent.prototype.logInternalTrace = function (transaction) {
  if (transaction.state && transaction.state.describer) {
    logger.trace({trace_dump : transaction.state.describer.verbose},
                 "Dumped transaction state.");
  }
};

module.exports = Agent;
