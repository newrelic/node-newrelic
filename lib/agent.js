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
  , TraceAggregator     = require(path.join(__dirname, 'transaction', 'trace', 'aggregator'))
  , Tracer              = require(path.join(__dirname, 'transaction', 'tracer', 'debug'))
  , Transaction         = require(path.join(__dirname, 'transaction'))
  ;

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
  this.config.on('change', this.updateApdexThreshold.bind(this));
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
  this.tracer = this.tracerSetup(this.config);
  this.traces = new TraceAggregator(this.config);
  this.traces.on('harvest', this.submitTransactionSampleData.bind(this));

  // agent events
  this.on('connectReady',        this.collectorSetup.bind(this));
  this.on('transactionFinished', this.mergeTransaction.bind(this));
  this.on('transactionFinished', this.errors.onTransactionFinished.bind(this.errors));
  this.on('transactionFinished', this.traces.add.bind(this.traces));
  this.on('restart',             this.restart.bind(this));
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
    return logger.warn("The New Relic Node.js agent is disabled by its configuration. Not starting!");
  }

  logger.info("Starting New Relic Node.js instrumentation.");

  this.harvesterHandle = setInterval(this.harvest.bind(this), 60 * 1000);
  sampler.start(this);

  this.connect();
};

/**
 * Any memory claimed by the agent will be retained after stopping.
 *
 * FIXME: make it possible to dispose of the agent, as well as do a
 * "hard" restart. This requires working with shimmer to strip the
 * current instrumentation and patch to the module loader.
 */
Agent.prototype.stop = function () {
  logger.info("Stopping New Relic Node.js instrumentation.");

  // stop the harvester coroutine
  if (this.harvesterHandle) clearInterval(this.harvesterHandle);

  // shut down the sampler (and its own coroutines)
  sampler.stop();

  // invalidate the old collector connection
  if (this.connection) {
    this.connection.sendShutdown();
    delete this.connection;
  }
};

Agent.prototype.restart = function () {
  logger.info("Restarting the agent's connection to New Relic.");

  this.stop();
  this.start();
};

/**
 * Wait a little while for the http instrumentation to notice an application
 * port, so that information can be sent to the collector with the initial
 * handshake.
 *
 * FIXME: never stops trying to connect to the collector
 * TODO: make the interval configurable and shorter by default, preferably with back-off
 */
Agent.prototype.connect = function () {
  if (!this.applicationPort) {
    logger.debug("No listeners detected, waiting another 15 seconds before finishing startup.");
    setTimeout(this.emit.bind(this, 'connectReady'), 15 * 1000);
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
  this.normalizer.load(response);
};

/**
 * Update the metric renaming rules.
 */
Agent.prototype.updateRenameRules = function (metricIDs) {
  if (!metricIDs) return logger.warn('Unable to update metric renaming rules: no new rules passed in.');

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

/**
 * This is a join point between two event handlers -- the agent instance
 * waits for a message that it's ready to set up the connection to the
 * collector, and then registers a bunch of handlers to join functionality
 * it controls to the collector connection. The messages coming from the
 * collector connection don't actually appear in the code; they're automatically
 * created based on the type of the message returned by the collector.
 */
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
Agent.prototype.tracerSetup = function (config) {
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
 *
 * TODO: verify that the error handler doesn't hold references and leak
 */
Agent.prototype.submitErrorData = function () {
  this.metrics.getOrCreateMetric('Errors/all').stats.incrementCallCount(this.errors.errorCount);
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
    if (this.config.debug.supportability) metrics.merge(this.config.debug.supportability);
    this.metrics = new Metrics(this.apdexT, this.renamer, this.normalizer);

    this.connection.sendMetricData(metrics.lastSendTime / 1000, Date.now() / 1000, metrics);
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
Agent.prototype.mergeMetrics = function (metrics) {
  this.metrics.merge(metrics);
  this.emit('metricsMerged');
};

/**
 * Trigger the connection to the collector via a side effect.
 *
 * @param number port Where the first-noticed HTTP listener is bound.
 */
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
