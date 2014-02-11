'use strict';

var path             = require('path')
  , util             = require('util')
  , EventEmitter     = require('events').EventEmitter
  , logger           = require(path.join(__dirname, 'logger.js'))
  , sampler          = require(path.join(__dirname, 'sampler.js'))
  , NAMES            = require(path.join(__dirname, 'metrics', 'names.js'))
  , CollectorAPI     = require(path.join(__dirname, 'collector', 'api.js'))
  , ErrorTracer      = require(path.join(__dirname, 'error.js'))
  , Metrics          = require(path.join(__dirname, 'metrics.js'))
  , MetricNormalizer = require(path.join(__dirname, 'metrics', 'normalizer.js'))
  , MetricMapper     = require(path.join(__dirname, 'metrics', 'mapper.js'))
  , TraceAggregator  = require(path.join(__dirname, 'transaction', 'trace',
                                         'aggregator.js'))
  ;

/*
 *
 * CONSTANTS
 *
 */

var STATES = [
  'stopped',      // start state
  'starting',     // handshaking with NR
  'connected',    // connected to collector
  'disconnected', // disconnected from collector
  'started',      // up and running
  'stopping',     // shutting down
  'errored'       // stopped due to error
];

// just to make clear what's going on
var TO_MILLIS   = 1e3
  , FROM_MILLIS = 1e-3
  ;

/**
 * There's a lot of stuff in this constructor, due to Agent acting as the
 * orchestrator for New Relic within instrumented applications.
 *
 * This constructor can throw if, for some reason, the configuration isn't
 * available. Don't try to recover here, because without configuration the
 * agent can't be brought up to a useful state.
 */
function Agent(config) {
  EventEmitter.call(this);

  if (!config) throw new Error("Agent must be created with a configuration!");

  this._state = 'stopped';

  this.config = config;
  this.config.on('apdex_t', this._apdexTChange.bind(this));
  this.config.on('data_report_period', this._harvesterIntervalChange.bind(this));

  this.environment = require(path.join(__dirname, 'environment'));
  this.version     = this.config.version;

  this.collector = new CollectorAPI(this);

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

  // user naming and ignoring rules
  this.userNormalizer = new MetricNormalizer(this.config, 'user');
  this.userNormalizer.loadFromConfig();

  // transaction traces
  this.tracer = this._setupTracer();
  this.traces = new TraceAggregator(this.config);

  // supportability
  if (this.config.debug.internal_metrics) {
    this.config.debug.supportability = new Metrics(
      this.config.apdex_t,
      this.mapper,
      this.metricNameNormalizer
    );
  }

  // hidden class
  this.harvesterHandle = null;

  // agent events
  this.on('transactionFinished', this._transactionFinished.bind(this));
}
util.inherits(Agent, EventEmitter);

/**
 * The agent is meant to only exist once per application, but the singleton is
 * managed by index.js. An agent will be created even if the agent's disabled by
 * the configuration.
 *
 * @config {boolean} agent_enabled Whether to start up the agent.
 *
 * @param {Function} callback Continuation and error handler.
 */
Agent.prototype.start = function (callback) {
  if (!callback) throw new TypeError("callback required!");

  var agent = this;

  this.state('starting');

  if (this.config.agent_enabled !== true) {
    logger.warn("The New Relic Node.js agent is disabled by its configuration. " +
                "Not starting!");

    this.state('stopped');
    return process.nextTick(callback);
  }

  if (!(this.config.license_key)) {
    logger.error("A valid account license key cannot be found. " +
                 "Has a license key been specified in the agent configuration " +
                 "file or via the NEW_RELIC_LICENSE_KEY environment variable?");

    this.state('errored');
    return process.nextTick(function () {
      callback(new Error("Not starting without license key!"));
    });
  }

  sampler.start(agent);

  logger.info("Starting New Relic for Node.js connection process.");

  this.collector.connect(function (error, config) {
    if (error) {
      agent.state('errored');
      return callback(error, config);
    }

    if (agent.collector.isConnected()) {
      // harvest immediately for quicker data display
      agent.harvest(function (error) {
        agent._startHarvester(agent.config.data_report_period);

        agent.state('started');
        callback(error, config);
      });
    }
    else {
      process.nextTick(function () { callback(null, config); });
    }
  });
};

/**
 * Any memory claimed by the agent will be retained after stopping.
 *
 * FIXME: make it possible to dispose of the agent, as well as do a
 * "hard" restart. This requires working with shimmer to strip the
 * current instrumentation and patch to the module loader.
 */
Agent.prototype.stop = function (callback) {
  if (!callback) throw new TypeError("callback required!");

  var agent = this;

  this.state('stopping');
  this._stopHarvester();
  sampler.stop();

  if (this.collector.isConnected()) {
    this.collector.shutdown(function (error) {
      if (error) {
        agent.state('errored');
        logger.warn(error, "Got error shutting down connection to New Relic:");
      }
      else {
        agent.state('stopped');
        logger.info("Stopped New Relic for Node.js.");
      }

      callback(error);
    });
  }
  else {
    process.nextTick(callback);
  }
};

/**
 * On agent startup, an interval timer is started that calls this method once
 * a minute, which in turn invokes the pieces of the harvest cycle. It calls
 * the various collector API methods in order, bailing out if one of them fails,
 * to ensure that the agents don't pummel the collector if it's already
 * struggling.
 */
Agent.prototype.harvest = function (callback) {
  if (!callback) throw new TypeError("callback required!");

  var agent = this;

  if (this.collector.isConnected()) {
    agent._sendMetrics(function (error) {
      if (error) return callback(error);

      agent._sendErrors(function (error) {
        if (error) return callback(error);

        agent._sendTrace(callback);
      });
    });
  }
  else {
    process.nextTick(function () {
      callback(new Error("Not connected to New Relic!"));
    });
  }
};

/**
 * Public interface for passing configuration data from the collector
 * on to the configuration, in an effort to keep them at least somewhat
 * decoupled.
 *
 * @param {object} configuration New config JSON from the collector.
 */
Agent.prototype.reconfigure = function reconfigure(configuration) {
  if (!configuration) throw new TypeError("must pass configuration");

  this.config.onConnect(configuration);
};

/**
 * Make it easier to determine what state the agent thinks it's in (needed
 * for a few tests, but fragile).
 *
 * FIXME: remove the need for this
 *
 * @param {string} newState The new state of the agent.
 */
Agent.prototype.state = function state(newState) {
  if (STATES.indexOf(newState) === -1) {
    throw new TypeError("Invalid state " + newState);
  }
  logger.debug("Agent state changed from %s to %s.", this._state, newState);
  this._state = newState;
  this.emit(this._state);
};

/**
 * Server-side configuration value.
 *
 * @param {number} apdexT Apdex tolerating value, in seconds.
 */
Agent.prototype._apdexTChange = function (apdexT) {
  logger.debug("Apdex tolerating value changed to %s.", apdexT);
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
Agent.prototype._harvesterIntervalChange = function (interval, callback) {
  var agent = this;

  // only change the setup if the harvester is currently running
  if (this.harvesterHandle) {
    // force a harvest now, to be safe
    this.harvest(function (error) {
      agent._restartHarvester(interval);
      if (callback) callback(error);
    });
  }
  else {
    if (callback) process.nextTick(callback);
  }
};

/**
 * Restart the harvest cycle timer.
 *
 * @param {number} harvestSeconds How many seconds between harvests.
 */
Agent.prototype._restartHarvester = function (harvestSeconds) {
  this._stopHarvester();
  this._startHarvester(harvestSeconds);
};

/**
 * Safely stop the harvest cycle timer.
 */
Agent.prototype._stopHarvester = function () {
  if (this.harvesterHandle) clearInterval(this.harvesterHandle);
  this.harvesterHandle = undefined;
};

/**
 * Safely start the harvest cycle timer, and ensure that the harvest
 * cycle won't keep an application from exiting if nothing else is
 * happening to keep it up.
 *
 * @param {number} harvestSeconds How many seconds between harvests.
 */
Agent.prototype._startHarvester = function (harvestSeconds) {
  var agent = this;
  function onError(error) {
    if (error) {
      logger.info(error, "Error on submission to New Relic (data held for redelivery):");
    }
  }
  function harvester() { agent.harvest(onError); }

  this.harvesterHandle = setInterval(harvester, harvestSeconds * TO_MILLIS);
  // timer.unref is 0.9+
  if (this.harvesterHandle.unref) this.harvesterHandle.unref();
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
Agent.prototype._setupTracer = function () {
  var Tracer;
  var debug = this.config.debug;
  if (debug && debug.tracer_tracing) {
    Tracer = require(path.join(__dirname, 'transaction', 'tracer', 'debug'));
  }
  else {
    Tracer = require(path.join(__dirname, 'transaction', 'tracer'));
  }

  return new Tracer(this);
};

/**
 * The pieces of supportability metrics are scattered all over the place -- only
 * send supportability metrics if they're explicitly enabled in the
 * configuration.
 *
 * @param {Function} callback Gets any delivery errors.
 */
Agent.prototype._sendMetrics = function (callback) {
  var agent = this;

  if (this.collector.isConnected()) {
    if (this.errors.errorCount > 0) {
      var count = this.errors.errorCount;
      this.metrics.getOrCreateMetric(NAMES.ERRORS.ALL).incrementCallCount(count);
    }

    if (this.config.debug.supportability) {
      this.metrics.merge(this.config.debug.supportability);
    }

    // wait to check until all the standard stuff has been added
    if (this.metrics.toJSON().length < 1) {
      logger.debug("No metrics to send.");
      return process.nextTick(callback);
    }

    var metrics      = this.metrics
      , beginSeconds = metrics.started * FROM_MILLIS
      , endSeconds   = Date.now() * FROM_MILLIS
      , payload      = [this.config.run_id, beginSeconds, endSeconds, metrics]
      ;

    // reset now to avoid losing metrics that come in after delivery starts
    this.metrics = new Metrics(
      this.config.apdex_t,
      this.mapper,
      this.metricNameNormalizer
    );

    this.collector.metricData(payload, function (error, rules) {
      if (error) agent.metrics.merge(metrics);
      if (rules) agent.mapper.load(rules);

      callback(error);
    });
  }
  else {
    process.nextTick(function () {
      callback(new Error("not connected to New Relic (metrics will be held)"));
    });
  }
};

/**
 * The error tracer doesn't know about the agent, and the connection
 * doesn't know about the error tracer. Only the agent knows about both.
 *
 * @param {Function} callback Gets any delivery errors.
 */
Agent.prototype._sendErrors = function (callback) {
  var agent = this;

  if (this.config.collect_errors && this.config.error_collector.enabled) {
    if (!this.collector.isConnected()) {
      return process.nextTick(function () {
        callback(new Error("not connected to New Relic (errors will be held)"));
      });
    }
    else if (this.errors.errors < 1) {
      logger.debug("No errors to send.");
      return process.nextTick(callback);
    }

    var errors  = this.errors.errors
      , payload = [this.config.run_id, errors]
      ;

    // reset now to avoid losing errors that come in after delivery starts
    this.errors = new ErrorTracer(agent.config);

    this.collector.errorData(payload, function (error) {
      if (error) agent.errors.merge(errors);

      callback(error);
    });
  }
  else {
    process.nextTick(callback);
  }
};

/**
 * The trace aggregator has its own harvester, which is already
 * asynchronous, due to its need to compress the nested transaction
 * trace data.
 *
 * @param {Function} callback Gets any encoding or delivery errors.
 */
Agent.prototype._sendTrace = function (callback) {
  var agent = this;
  if (this.config.collect_traces && this.config.transaction_tracer.enabled) {
    if (!this.collector.isConnected()) {
      return process.nextTick(function () {
        callback(new Error("not connected to New Relic (slow trace data will be held)"));
      });
    }

    this.traces.harvest(function (error, encoded, trace) {
      if (error || !encoded) return callback(error);

      var payload = [agent.config.run_id, [encoded]];
      agent.collector.transactionSampleData(payload, function (error) {
        if (!error) agent.traces.reset(trace);

        callback(error);
      });
    });
  }
  else {
    process.nextTick(callback);
  }
};

/**
 * Put all the logic for handing finalized transactions off to the tracers and
 * metric collections in one place.
 *
 * @param {Transaction} transaction Newly-finalized transaction.
 */
Agent.prototype._transactionFinished = function (transaction) {
  // only available when this.config.debug.tracer_tracing is true
  if (transaction.describer) {
    logger.trace({trace_dump : transaction.describer.verbose},
                 "Dumped transaction state.");
  }

  if (!transaction.ignore) {
    if (transaction.forceIgnore === false) {
      logger.debug("Explicitly not ignoring %s.", transaction.name);
    }
    this.metrics.merge(transaction.metrics);
    this.errors.onTransactionFinished(transaction, this.metrics);
    this.traces.add(transaction);
  }
  else {
    if (transaction.forceIgnore === true) {
      logger.debug("Explicitly ignoring %s.", transaction.name);
    }
    else {
      logger.debug("Ignoring %s.", transaction.name);
    }
  }
};

/**
 * Get the current transaction (if there is one) from the tracer.
 *
 * @returns {Transaction} The current transaction.
 */
Agent.prototype.getTransaction = function () {
  return this.tracer.getTransaction();
};

module.exports = Agent;
