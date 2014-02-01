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

// just to make clear what's going on
var TO_MILLIS = 1e3;

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

  this.config = config;
  this.config.on('apdex_t', this.onApdexTChange.bind(this));
  this.config.on('data_report_period', this.onHarvesterIntervalChange.bind(this));

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
  this.tracer = this.setupTracer();
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
  this.on('transactionFinished', this.onTransactionFinished.bind(this));
}
util.inherits(Agent, EventEmitter);

/**
 * The agent is meant to only exist once per application, but the singleton is
 * managed by index.js. An agent will be created even if the agent's disabled by
 * the configuration.
 *
 * @config agent_enabled (true|false) Whether to start up the agent.
 */
Agent.prototype.start = function (callback) {
  if (!callback) throw new TypeError("callback required!");

  var agent = this;

  if (this.config.agent_enabled !== true) {
    logger.warn("The New Relic Node.js agent is disabled by its configuration. " +
                "Not starting!");

    return process.nextTick(callback);
  }

  if (!(this.config.license_key)) {
    logger.error("A valid account license key cannot be found. " +
                 "Has a license key been specified in the agent configuration " +
                 "file or via the NEW_RELIC_LICENSE_KEY environment variable?");

    return process.nextTick(function () {
      callback(new Error("Not starting without license key!"));
    });
  }

  logger.info("Starting New Relic for Node.js connection process.");

  this._connect(function (error) {
    if (error) return callback(error);

    if (agent.collector.isConnected()) {
      sampler.start(agent);
      agent.restartHarvester(agent.config.data_report_period);
    }

    callback(null);
  });
};

Agent.prototype._connect = function _connect(callback) {
  var agent = this;
  this.collector.connect(function (error, config) {
    if (error) return callback(error, config);

    if (!config) {
      logger.warn("No configuration returned by New Relic after connecting.");
    }
    else {
      agent.config.onConnect(config);
    }

    callback(null, config);
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
  logger.info("New Relic Node.js instrumentation stopped.");
  if (this.harvesterHandle) {
    clearInterval(this.harvesterHandle);
    this.harvesterHandle = null;
  }
  sampler.stop();

  this.collector.shutdown(function (error) {
    if (error) {
      logger.warn(error, "Got error shutting down connection to New Relic:");
    }
    else {
      logger.info("Connection to New Relic's servers closed.");
    }

    callback(error);
  });
};

Agent.prototype.restart = function (callback) {
  var agent = this;

  logger.info("Resetting the agent's connection to New Relic.");

  this.stop(function () {
    agent.start(function () {
      logger.info("Agent's connection to New Relic restarted.");
      callback();
    });
  });
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
 * // FIXME: this also needs a test, and is wrong
 *
 * @param {number} interval Time in seconds between harvest runs.
 */
Agent.prototype.onHarvesterIntervalChange = function (interval) {
  // only change the setup if the harvester is currently running
  if (this.harvesterHandle) {
    // force a harvest now, to be safe
    this.harvest();
    this.restartHarvester(interval);
  }
};

/**
 * Safely (re)start the harvest timer, and ensure that the harvest cycle won't
 * keep an application from exiting if nothing else is happening to keep it up.
 *
 * @param {number} harvestSeconds How many seconds between harvests.
 */
Agent.prototype.restartHarvester = function (harvestSeconds) {
  var agent = this;
  function onError(error) {
    if (error) {
      logger.warn(error, "Error on submission to New Relic (data held for redelivery):");
    }
  }
  function harvester() { agent.harvest(onError); }

  if (this.harvesterHandle) clearInterval(this.harvesterHandle);
  // FIXME: this needs a test something fierce
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
Agent.prototype.setupTracer = function () {
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
 * On agent startup, an interval timer is started that calls this method once
 * a minute, which in turn invokes the pieces of the harvest cycle. It calls
 * the various collector API methods in order, bailing out if one of them fails,
 * to ensure that the agents don't pummel the collector if it's already
 * struggling.
 */
Agent.prototype.harvest = function (callback) {
  var agent = this;

  if (this.collector.isConnected()) {
    agent.submitMetricData(function (error) {
      if (error) return callback(error);

      agent.submitErrorData(function (error) {
        if (error) return callback(error);

        agent.submitTransactionSampleData(callback);
      });
    });
  }
};

/**
 * The pieces of supportability metrics are scattered all over the place -- only
 * send supportability mnetrics if they're explicitly enabled in the
 * configuration.
 */
Agent.prototype.submitMetricData = function (callback) {
  this.metrics
    .getOrCreateMetric(NAMES.ERRORS.ALL)
    .incrementCallCount(this.errors.errorCount);

  if (this.config.debug.supportability) {
    this.metrics.merge(this.config.debug.supportability);
  }

  var metrics = this.metrics;
  this.metrics = new Metrics(
    this.config.apdex_t,
    this.mapper,
    this.metricNameNormalizer
  );

  var agent = this;
  this.collector.metricData(metrics, function (error, rules) {
    if (error) agent.metrics.merge(metrics);
    if (rules) agent.mapper.load(rules);

    callback(error);
  });
};

/**
 * The error tracer doesn't know about the agent, and the connection doesn't
 * know about the error tracer. Only the agent knows about both.
 */
Agent.prototype.submitErrorData = function (callback) {
  var agent = this;
  if (agent.config.collect_errors && agent.config.error_collector.enabled) {
    this.collector.errorData(this.errors.errors, function (error) {
      if (!error) agent.errors = new ErrorTracer(agent.config);

      callback(error);
    });
  }
  else {
    process.nextTick(callback);
  }
};

Agent.prototype.submitTransactionSampleData = function (callback) {
  var agent = this;
  if (this.config.collect_traces && this.config.transaction_tracer.enabled) {
    this.traces.harvest(function (error, encoded) {
      if (error || !encoded) return callback(error);

      agent.collector.transactionSampleData([encoded], function (error) {
        if (!error) agent.traces.reset();

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
Agent.prototype.onTransactionFinished = function (transaction) {
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
