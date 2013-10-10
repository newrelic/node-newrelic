'use strict';

var path                = require('path')
  , util                = require('util')
  , EventEmitter        = require('events').EventEmitter
  , logger              = require(path.join(__dirname, 'logger'))
  , sampler             = require(path.join(__dirname, 'sampler'))
  , NAMES               = require(path.join(__dirname, 'metrics', 'names'))
  , CollectorConnection = require(path.join(__dirname, 'collector', 'connection'))
  , ErrorTracer         = require(path.join(__dirname, 'error'))
  , Metrics             = require(path.join(__dirname, 'metrics'))
  , MetricNormalizer    = require(path.join(__dirname, 'metrics', 'normalizer'))
  , MetricMapper        = require(path.join(__dirname, 'metrics', 'mapper'))
  , TraceAggregator     = require(path.join(__dirname, 'transaction',
                                            'trace', 'aggregator'))
  ;

/*
 *
 * CONSTANTS
 *
 */

// just to make clear what's going on
var TO_MILLIS = 1000;

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
function Agent(config, options) {
  EventEmitter.call(this);

  if (!config) throw new Error("Agent must be created with a configuration!");

  // For testing, accept an options object to override bits of agent config.
  this.options = options || {};

  this.config = config;
  this.config.on('apdex_t', this.onApdexTChange.bind(this));
  this.config.on('data_report_period', this.onHarvesterIntervalChange.bind(this));
  logger.level(this.config.logging && this.config.logging.level || 'info');

  this.environment = require(path.join(__dirname, 'environment'));
  this.version     = this.config.version;

  // error tracing
  this.errors = new ErrorTracer(this.config);

  // metrics
  this.mapper = new MetricMapper();
  this.metricNameNormalizer = new MetricNormalizer(this.config, 'metric name');
  this.config.on(
    'metric_name_rules',
    this.metricNameNormalizer.load.bind(this.metricNameNormalizer)
  );
  this.metrics = new Metrics(this.config.apdex_t, this.mapper, this.metricNameNormalizer);

  // transaction naming
  this.transactionNameNormalizer = new MetricNormalizer(this.config, 'transaction name');
  this.config.on(
    'transaction_name_rules',
    this.transactionNameNormalizer.load.bind(this.transactionNameNormalizer)
  );
  this.urlNormalizer = new MetricNormalizer(this.config, 'URL');
  this.config.on('url_rules', this.urlNormalizer.load.bind(this.urlNormalizer));
  this.urlNormalizer.loadFromConfig();

  // transaction traces
  this.tracer = this.setupTracer(this.config);
  this.traces = new TraceAggregator(this.config);
  this.traces.on('harvest', this.submitTransactionSampleData.bind(this));

  // supportability
  if (this.config.debug.internal_metrics) {
    this.config.debug.supportability = new Metrics(
      this.config.apdex_t,
      this.mapper,
      this.metricNameNormalizer
    );
  }

  // hidden class
  this.harvesterHandle  = null;
  this.connectionHandle = null;

  // agent events
  this.on('ready',               this._connect.bind(this));
  this.on('transactionFinished', this.mergeTransaction.bind(this));
  this.on('transactionFinished', this.errorsFromTransaction.bind(this));
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
  this.harvesterHandle = setInterval(this.harvest.bind(this),
                                     this.config.data_report_period * TO_MILLIS);

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
    if (this.connectionHandle) clearTimeout(this.connectionHandle);
    this.connection.end();
    this.connectionFailures = null;
    this.connection = null;
  }

  logger.info("New Relic Node.js instrumentation stopped.");
};

Agent.prototype.restart = function () {
  logger.info("Resetting the agent's connection to New Relic.");

  this.stop();
  this.start();
};

/**
 * Server-side configuration value.
 *
 * @param {number} apdexT Apdex tolerating value, in seconds.
 */
Agent.prototype.onApdexTChange = function (apdexT) {
  logger.info("Apdex tolerating value changed to %s.", apdexT);
  this.metrics.apdexT = apdexT;
  if (this.config.debug.supportability) {
    this.config.debug.supportability.apdexT = apdexT;
  }
};

/**
 * Server-side configuration value. When run, forces a harvest cycle
 * so as to not cause the agent to go too long without reporting.
 *
 * @param {number} interval Time in seconds between harvest runs.
 */
Agent.prototype.onHarvesterIntervalChange = function (interval) {
  // only change the setup if the harvester is currently running
  if (this.harvesterHandle) {
    clearInterval(this.harvesterHandle);
    // force a harvest now, to be safe
    this.harvest();
    this.harvesterHandle = setInterval(this.harvest.bind(this), interval * TO_MILLIS);
  }
};

Agent.prototype.onNewMappings = function (rules) {
  this.mapper.load(rules);
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
  this.connection.on('connect',            this.emit.bind(this, 'connected'));
  this.connection.on('metricDataResponse', this.onNewMappings.bind(this));
  this.connection.on('metricDataError',    this.mergeMetrics.bind(this));
  this.connection.on('errorDataError',     this.mergeErrors.bind(this));

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

  // the agent's already been stopped
  if (!this.connection) return;

  var backoff = this.nextBackoff();
  if (backoff.warn) {
    logger.warn("The agent hasn't connected to the collector after %s attempts.",
                this.connectionFailures);
  }

  logger.info("Next attempting to connect to collector in %s seconds.",
              backoff.interval);
  this.connectionHandle = setTimeout(this._nextConnectAttempt.bind(this, backoff.error),
                                     backoff.interval * TO_MILLIS);
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
  this.connectionFailures += 1;

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
    Tracer = require(path.join(__dirname, 'transaction', 'tracer', 'debug'));
    this.on('transactionFinished', this.logInternalTrace);
  }
  else {
    Tracer = require(path.join(__dirname, 'transaction', 'tracer'));
  }

  return new Tracer(this);
};

/**
 * On agent startup, an interval timer is started that calls this method once
 * a minute, which in turn invokes the pieces of the harvest cycle.
 */
Agent.prototype.harvest = function () {
  if (this.connection && this.connection.isConnected()) {
    this.submitMetricData();

    if (this.config.collect_errors &&
        this.config.error_collector.enabled) {
      this.submitErrorData();
    }

    if (this.config.collect_traces &&
        this.config.transaction_tracer.enabled) {
      this.traces.harvest();
    }

    this.clear();
  }
};

/**
 * Replacing the per-harvest collections associated with the agent in the
 * individual harvest methods can lead to weird order dependency issues (e.g.
 * the sent metrics not including the error count because the error collection
 * was reset before the metrics were sent).
 */
Agent.prototype.clear = function () {
  this.metrics = new Metrics(this.config.apdex_t, this.mapper, this.metricNameNormalizer);
  this.errors  = new ErrorTracer(this.config);
};

/**
 * The error tracer doesn't know about the agent, and the connection doesn't
 * know about the error tracer. Only the agent knows about both.
 */
Agent.prototype.submitErrorData = function () {
  this.connection.sendTracedErrors(this.errors.errors);
};

/**
 * The pieces of supportability metrics are scattered all over the place -- only
 * send supportability mnetrics if they're explicitly enabled in the
 * configuration.
 */
Agent.prototype.submitMetricData = function () {
  this.metrics
    .getOrCreateMetric(NAMES.ERRORS.ALL)
    .incrementCallCount(this.errors.errorCount);

  if (this.config.debug.supportability) {
    this.metrics.merge(this.config.debug.supportability);
  }

  this.connection.sendMetricData(this.metrics);
};

/**
 * The connection methods are written generically, so they expect arrays, even
 * though top N transaction logic dictates that only one transaction will be
 * sent per harvest cycle.
 *
 * @param {Array} encoded JSON array with encoded contents to be submitted.
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
  this.metrics.merge(transaction.metrics);
  this.emit('metricsMerged');
};

/**
 * Because the agent replaces the error tracer on each harvest cycle,
 * insert a layer of indirection between transactionFinished events
 * and the errror tracer.
 *
 * @param {Transaction} transaction
 */
Agent.prototype.errorsFromTransaction = function (transaction) {
  this.errors.onTransactionFinished(transaction);
};

/**
 * Need to have a level of indirection between the event handler and the
 * metrics property to ensure that we're using the current metrics object
 * and am not holding a reference to the very first metrics object created
 * upon instantiation.
 *
 * @param {Metrics} data The data object to be serialized and
 *                       sent to the collector. The metrics will always be
 *                       the fourth element.
 * @param {Error} error The error returned from the collector.
 */
Agent.prototype.mergeMetrics = function (data, error) {
  if (this.connection && this.connection.discard(error.statusCode)) {
    logger.warn("Got %s from collector, discarding metrics.", error.statusCode);
    return;
  }

  logger.warn(error, "Merging metrics from last harvest cycle because:");

  this.metrics.merge(data[3]);
  this.emit('metricsMerged');
};

/**
 * Need to have a level of indirection between the event handler and the
 * list of errors to ensure that we're using the current error tracer
 * and am not holding a reference to the very first error tracer created
 * upon instantiation.
 *
 * @param {Metrics} data The data object to be serialized and
 *                       sent to the collector. The list of errors will
 *                       always be the second element.
 * @param {Error} error The error returned from the collector.
 */
Agent.prototype.mergeErrors = function (data, error) {
  if (this.connection && this.connection.discard(error.statusCode)) {
    logger.warn("Got %s from collector, discarding traced errors.", error.statusCode);
    return;
  }

  logger.warn(error, "Merging errors from last harvest cycle because:");

  this.errors.merge(data[1]);
  this.emit('errorsMerged');
};

/**
 * Get the current transaction (if there is one) from the tracer.
 *
 * @returns {Transaction} The current transaction.
 */
Agent.prototype.getTransaction = function () {
  return this.tracer.getTransaction();
};

/**
 * Only used when tracer tracing is enabled. Dumps a representation of the
 * internal state of the tracer for a given transaction; only really useful
 * to agent developers.
 *
 * @param {Transaction} transaction Transaction with a debugging transaction
 *                                  trace.
 */
Agent.prototype.logInternalTrace = function (transaction) {
  if (transaction.state && transaction.state.describer) {
    logger.trace({trace_dump : transaction.state.describer.verbose},
                 "Dumped transaction state.");
  }
};

module.exports = Agent;
