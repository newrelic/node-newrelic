'use strict'

const AdaptiveSampler = require('./adaptive-sampler')
const CollectorAPI = require('./collector/api')
const DESTINATIONS = require('./config/attribute-filter').DESTINATIONS
const ErrorAggregator = require('./errors/aggregator')
const EventEmitter = require('events').EventEmitter
const Harvest = require('./harvest')
const hashes = require('./util/hashes')
const logger = require('./logger')
const MetricMapper = require('./metrics/mapper')
const MetricNormalizer = require('./metrics/normalizer')
const Metrics = require('./metrics')
const NAMES = require('./metrics/names')
const PriorityQueue = require('./priority-queue')
const QueryTracer = require('./db/tracer')
const sampler = require('./sampler')
const SpanAggregator = require('./spans/aggregator')
const TraceAggregator = require('./transaction/trace/aggregator')
const Tracer = require('./transaction/tracer')
const TxSegmentNormalizer = require('./metrics/normalizer/tx_segment')
const uninstrumented = require('./uninstrumented')
const util = require('util')

const STATES = [
  'stopped',      // start state
  'starting',     // handshaking with NR
  'connected',    // connected to collector
  'disconnected', // disconnected from collector
  'started',      // up and running
  'stopping',     // shutting down
  'errored'       // stopped due to error
]

// just to make clear what's going on
const TO_MILLIS = 1e3

/**
 * There's a lot of stuff in this constructor, due to Agent acting as the
 * orchestrator for New Relic within instrumented applications.
 *
 * This constructor can throw if, for some reason, the configuration isn't
 * available. Don't try to recover here, because without configuration the
 * agent can't be brought up to a useful state.
 */
function Agent(config) {
  EventEmitter.call(this)

  if (!config) throw new Error('Agent must be created with a configuration!')

  // The agent base attributes which last throughout its lifetime.
  this._state = 'stopped'
  this.config = config
  this.environment = require('./environment')
  this.version = this.config.version
  this.collector = new CollectorAPI(this)

  // Reset the agent to add all the sub-objects it needs. These object are the
  // ones that get re-created if the agent is told to restart from the collector.
  this.events = null
  this.customEvents = null
  this.errors = null
  this.mapper = null
  this.metricNameNormalizer = null
  this.metrics = null
  this.spans = null
  this.transactionNameNormalizer = null
  this.txSegmentNormalizer = null
  this.urlNormalizer = null
  this.userNormalizer = null
  this.reset()

  // Transaction tracing.
  this.tracer = new Tracer(this)
  this.traces = new TraceAggregator(this.config)
  this.transactionSampler = new AdaptiveSampler({
    period: config.sampling_target_period_in_seconds * 1000,
    target: config.sampling_target
  })

  // Query tracing.
  this.queries = new QueryTracer(this.config)

  // Set up all the configuration events the agent needs to listen for.
  this._listenForConfigChanges()

  // Entity tracking metrics.
  this.totalActiveSegments = 0
  this.segmentsCreatedInHarvest = 0
  this.segmentsClearedInHarvest = 0
  this.activeTransactions = 0
  this.transactionsCreatedInHarvest = 0

  // Harvest attributes.
  this.harvesterHandle = null
  this._lastHarvest = null

  // Finally, add listeners for the agent's own events.
  this.on('transactionFinished', this._transactionFinished.bind(this))
}
util.inherits(Agent, EventEmitter)

/**
 * The agent is meant to only exist once per application, but the singleton is
 * managed by index.js. An agent will be created even if the agent's disabled by
 * the configuration.
 *
 * @config {boolean} agent_enabled Whether to start up the agent.
 *
 * @param {Function} callback Continuation and error handler.
 */
Agent.prototype.start = function start(callback) {
  if (!callback) throw new TypeError('callback required!')

  var agent = this

  this.setState('starting')

  if (this.config.agent_enabled !== true) {
    logger.warn('The New Relic Node.js agent is disabled by its configuration. ' +
                'Not starting!')

    this.setState('stopped')
    return process.nextTick(callback)
  }

  if (!(this.config.license_key)) {
    logger.error('A valid account license key cannot be found. ' +
                 'Has a license key been specified in the agent configuration ' +
                 'file or via the NEW_RELIC_LICENSE_KEY environment variable?')

    this.setState('errored')
    return process.nextTick(function onNextTick() {
      callback(new Error('Not starting without license key!'))
    })
  }

  sampler.start(agent)

  logger.info('Starting New Relic for Node.js connection process.')

  this.collector.connect(function onConnect(error, config) {
    if (error) {
      agent.setState('errored')
      sampler.stop()
      return callback(error, config)
    }

    if (agent.collector.isConnected() && !agent.config.no_immediate_harvest) {
      // harvest immediately for quicker data display, but after at least 1
      // second or the collector will throw away the data.
      //
      // NOTE: this setTimeout is deliberately NOT unref'd due to it being
      // the last step in the Agent startup process
      setTimeout(function afterTimeout() {
        agent.harvest(function onHarvest(harvestError) {
          agent._startHarvester(agent.config.data_report_period)

          agent.setState('started')
          callback(harvestError, config)
        })
      }, 1000)
    } else {
      process.nextTick(function onNextTick() {
        callback(null, config)
      })
    }
  })
}

/**
 * Any memory claimed by the agent will be retained after stopping.
 *
 * FIXME: make it possible to dispose of the agent, as well as do a
 * "hard" restart. This requires working with shimmer to strip the
 * current instrumentation and patch to the module loader.
 */
Agent.prototype.stop = function stop(callback) {
  if (!callback) throw new TypeError('callback required!')

  var agent = this

  this.setState('stopping')
  this._stopHarvester()
  sampler.stop()

  if (this.collector.isConnected()) {
    this.collector.shutdown(function onShutdown(error) {
      if (error) {
        agent.setState('errored')
        logger.warn(error, 'Got error shutting down connection to New Relic:')
      } else {
        agent.setState('stopped')
        logger.info('Stopped New Relic for Node.js.')
      }

      callback(error)
    })
  } else {
    process.nextTick(callback)
  }
}

/**
 * Resets queries.
 *
 * @param {boolean} forceReset
 *   Flag signalling unconditional reset, sent during LASP application.
 */
Agent.prototype._resetQueries = function resetQueries(forceReset) {
  if (!this.queries || forceReset) {
    this.queries = new QueryTracer(this.config)
  }
}

/**
 * Resets errors.
 *
 * @param {boolean} forceReset
 *   Flag signalling unconditional reset, sent during LASP application.
 */
Agent.prototype._resetErrors = function resetErrors(forceReset) {
  if (!this.errors || forceReset) {
    this.errors = new ErrorAggregator(this.config)
  }
  this.errors.reconfigure(this.config)
}

/**
 * Resets events.
 */
Agent.prototype._resetEvents = function resetEvents() {
  if (!this.events) {
    this.events = new PriorityQueue()
  }
  this.events.setLimit(this.config.transaction_events.max_samples_per_minute)
  if (!this.customEvents) {
    this.customEvents = new PriorityQueue()
  }
}

/**
 * Resets custom events.
 *
 * @param {boolean} forceReset
 *   Flag signalling unconditional reset, sent during LASP application.
 */
Agent.prototype._resetCustomEvents = function resetCustomEvents(forceReset) {
  if (!this.customEvents || forceReset) {
    this.customEvents = new PriorityQueue()
  }
  this.customEvents.setLimit(this.config.custom_insights_events.max_samples_stored)
}

/**
 * Builds all of the sub-properties of the agent that rely on configurations.
 */
Agent.prototype.reset = function reset() {
  // Insights events.
  this._resetEvents()
  this._resetCustomEvents()

  // Error tracing.
  this._resetErrors()

  // Open tracing.
  this.spans = new SpanAggregator()

  // Metrics.
  this.mapper = new MetricMapper()
  this.metricNameNormalizer = new MetricNormalizer(this.config, 'metric name')
  this.metrics = new Metrics(this.config.apdex_t, this.mapper, this.metricNameNormalizer)

  // Transaction naming.
  this.transactionNameNormalizer = new MetricNormalizer(this.config, 'transaction name')
  this.urlNormalizer = new MetricNormalizer(this.config, 'URL')

  // Segment term based tx renaming for MGI mitigation.
  this.txSegmentNormalizer = new TxSegmentNormalizer()

  // User naming and ignoring rules.
  this.userNormalizer = new MetricNormalizer(this.config, 'user')
  this.userNormalizer.loadFromConfig()
}

/**
 * On agent startup, an interval timer is started that calls this method once
 * a minute, which in turn invokes the pieces of the harvest cycle. It calls
 * the various collector API methods in order, bailing out if one of them fails,
 * to ensure that the agents don't pummel the collector if it's already
 * struggling.
 */
Agent.prototype.harvest = function harvest(callback) {
  if (!callback) {
    throw new TypeError('callback required!')
  }

  // Generate metrics for this harvest and then check we are connected to the
  // collector.
  this._generateHarvestMetrics()
  if (!this.collector.isConnected()) {
    return setImmediate(function immediatelyError() {
      callback(new Error('Not connected to New Relic!'))
    })
  }

  // We have a connection, create a new harvest.
  this._lastHarvest = new Harvest(this)

  // Reset all our collections. The harvest has all the data it needs at this point.
  // TODO: Make each aggregator able to compose its own payload and clean itself
  // up. Then the Harvest class can just iterate over all aggregations without
  // having to know bespoke reset information.
  this.metrics = new Metrics(
    this.config.apdex_t,
    this.mapper,
    this.metricNameNormalizer
  )
  this.events = new PriorityQueue(
    this.config.transaction_events.max_samples_per_minute
  )
  this.customEvents = new PriorityQueue(
    this.config.custom_insights_events.max_samples_stored
  )
  this.errors.clearEvents()
  this.errors.clearErrors()
  this.traces.reset()
  this.queries = new QueryTracer(this.config)
  this.spans.clearEvents()

  // Send the harvest!
  this._lastHarvest.send(callback)
}

Agent.prototype._generateHarvestMetrics = function _generateHarvestMetrics() {
  // Note some information about the size of this harvest.
  if (logger.traceEnabled()) {
    logger.trace({
      segmentTotal: this.totalActiveSegments,
      harvestCreated: this.segmentsCreatedInHarvest,
      harvestCleared: this.segmentsClearedInHarvest,
      activeTransactions: this.activeTransactions,
      spansCollected: this.spans.length,
      spansSeen: this.spans.seen
    }, 'Entity stats on harvest')
  }
  this.recordSupportability(
    'Nodejs/Transactions/Created',
    this.transactionsCreatedInHarvest
  )

  // Send uninstrumented supportability metrics every harvest cycle
  uninstrumented.createMetrics(this.metrics)

  // Reset the counters.
  this.segmentsCreatedInHarvest = 0
  this.segmentsClearedInHarvest = 0
  this.transactionsCreatedInHarvest = 0
}

/**
 * Public interface for passing configuration data from the collector
 * on to the configuration, in an effort to keep them at least somewhat
 * decoupled.
 *
 * @param {object} configuration New config JSON from the collector.
 */
Agent.prototype.reconfigure = function reconfigure(configuration) {
  if (!configuration) throw new TypeError('must pass configuration')

  this.config.onConnect(configuration)
}

/**
 * Make it easier to determine what state the agent thinks it's in (needed
 * for a few tests, but fragile).
 *
 * FIXME: remove the need for this
 *
 * @param {string} newState The new state of the agent.
 */
Agent.prototype.setState = function setState(newState) {
  if (STATES.indexOf(newState) === -1) {
    throw new TypeError('Invalid state ' + newState)
  }
  logger.debug('Agent state changed from %s to %s.', this._state, newState)
  this._state = newState
  this.emit(this._state)
}

/**
 * Server-side configuration value.
 *
 * @param {number} apdexT Apdex tolerating value, in seconds.
 */
Agent.prototype._apdexTChange = function _apdexTChange(apdexT) {
  logger.debug('Apdex tolerating value changed to %s.', apdexT)
  this.metrics.apdexT = apdexT
}

/**
 * Server-side configuration value. When run, forces a harvest cycle
 * so as to not cause the agent to go too long without reporting.
 *
 * @param {number} interval Time in seconds between harvest runs.
 */
Agent.prototype._harvesterIntervalChange = _harvesterIntervalChange

function _harvesterIntervalChange(interval, callback) {
  var agent = this

  // only change the setup if the harvester is currently running
  if (this.harvesterHandle) {
    // force a harvest now, to be safe
    this.harvest(function onHarvest(error) {
      agent._restartHarvester(interval)
      if (callback) callback(error)
    })
  } else if (callback) {
    process.nextTick(callback)
  }
}

/**
 * Restart the harvest cycle timer.
 *
 * @param {number} harvestSeconds How many seconds between harvests.
 */
Agent.prototype._restartHarvester = function _restartHarvester(harvestSeconds) {
  this._stopHarvester()
  this._startHarvester(harvestSeconds)
}

/**
 * Safely stop the harvest cycle timer.
 */
Agent.prototype._stopHarvester = function _stopHarvester() {
  if (this.harvesterHandle) clearInterval(this.harvesterHandle)
  this.harvesterHandle = null
}

/**
 * Safely start the harvest cycle timer, and ensure that the harvest
 * cycle won't keep an application from exiting if nothing else is
 * happening to keep it up.
 *
 * @param {number} harvestSeconds How many seconds between harvests.
 */
Agent.prototype._startHarvester = function _startHarvester(harvestSeconds) {
  var agent = this

  function onError(error) {
    if (error) {
      logger.info(error, 'Error on submission to New Relic (data held for redelivery):')
    }
  }

  function harvester() {
    agent.harvest(onError)
  }

  this.harvesterHandle = setInterval(harvester, harvestSeconds * TO_MILLIS)
  this.harvesterHandle.unref()
}

/**
 * `agent_enabled` changed. This will generally only happen because of a high
 * security mode mismatch between the agent and the collector. This only
 * expects to have to stop the agent. No provisions have been made, nor
 * testing have been done to make sure it is safe to start the agent back up.
 */
Agent.prototype._enabledChange = function _enabledChange() {
  if (this.config.agent_enabled === false) {
    logger.warn('agent_enabled has been changed to false, stopping the agent.')
    this.stop(function nop() {})
  }
}

/**
 * Report new settings to collector after a configuration has changed. This
 * always occurs after handling a response from a connect call.
 */
Agent.prototype._configChange = function _configChange() {
  this.collector.reportSettings()
}

Agent.prototype._addIntrinsicAttrsFromTransaction = _addIntrinsicAttrsFromTransaction

function _addIntrinsicAttrsFromTransaction(transaction) {
  var intrinsicAttributes = {
    webDuration: transaction.timer.getDurationInMillis() / 1000,
    timestamp: transaction.timer.start,
    name: transaction.getFullName(),
    duration: transaction.timer.getDurationInMillis() / 1000,
    totalTime: transaction.trace.getTotalTimeDurationInMillis(),
    type: 'Transaction',
    error: transaction.hasErrors()
  }

  var metric = transaction.metrics.getMetric(NAMES.QUEUETIME)
  if (metric) {
    intrinsicAttributes.queueDuration = metric.total
  }

  metric = transaction.metrics.getMetric(NAMES.EXTERNAL.ALL)
  if (metric) {
    intrinsicAttributes.externalDuration = metric.total
    intrinsicAttributes.externalCallCount = metric.callCount
  }

  metric = transaction.metrics.getMetric(NAMES.DB.ALL)
  if (metric) {
    intrinsicAttributes.databaseDuration = metric.total
    intrinsicAttributes.databaseCallCount = metric.callCount
  }

  // If CAT is enabled, extract the data gleened from the CAT headers.
  if (this.config.cross_application_tracer.enabled) {
    if (this.config.distributed_tracing.enabled) {
      transaction.addDistributedTraceIntrinsics(intrinsicAttributes)
      if (transaction.parentSpanId) {
        intrinsicAttributes.parentSpanId = transaction.parentSpanId
      }

      if (transaction.parentId) {
        intrinsicAttributes.parentId = transaction.parentId
      }
    } else if (
      !transaction.invalidIncomingExternalTransaction && (
        transaction.referringTransactionGuid ||
        transaction.includesOutboundRequests()
      )
    ) {
      intrinsicAttributes['nr.guid'] = transaction.id
      intrinsicAttributes['nr.tripId'] = transaction.tripId || transaction.id
      intrinsicAttributes['nr.pathHash'] = hashes.calculatePathHash(
        this.config.applications()[0],
        transaction.getFullName(),
        transaction.referringPathHash
      )
      if (transaction.referringPathHash) {
        intrinsicAttributes['nr.referringPathHash'] = transaction.referringPathHash
      }
      if (transaction.referringTransactionGuid) {
        var refId = transaction.referringTransactionGuid
        intrinsicAttributes['nr.referringTransactionGuid'] = refId
      }
      var alternatePathHashes = transaction.alternatePathHashes()
      if (alternatePathHashes) {
        intrinsicAttributes['nr.alternatePathHashes'] = alternatePathHashes
      }
      if (transaction.baseSegment && transaction.type === 'web') {
        var apdex = (
          this.config.web_transactions_apdex[transaction.getFullName()] ||
          this.config.apdex_t
        )
        var duration = transaction.baseSegment.getDurationInMillis() / 1000
        intrinsicAttributes['nr.apdexPerfZone'] = calculateApdexZone(duration, apdex)
      }
    }
  }

  if (transaction.syntheticsData) {
    intrinsicAttributes['nr.syntheticsResourceId'] = transaction.syntheticsData.resourceId
    intrinsicAttributes['nr.syntheticsJobId'] = transaction.syntheticsData.jobId
    intrinsicAttributes['nr.syntheticsMonitorId'] = transaction.syntheticsData.monitorId
  }

  return intrinsicAttributes
}

function calculateApdexZone(duration, apdexT) {
  if (duration <= apdexT) {
    return 'S' // satisfied
  }

  if (duration <= apdexT * 4) {
    return 'T' // tolerating
  }

  return 'F' // frustrated
}

Agent.prototype._addEventFromTransaction = function _addEventFromTransaction(tx) {
  if (!this.config.transaction_events.enabled) return

  var intrinsicAttributes = this._addIntrinsicAttrsFromTransaction(tx)
  var userAttributes = tx.trace.custom.get(DESTINATIONS.TRANS_EVENT)
  var agentAttributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)

  var event = [
    intrinsicAttributes,
    userAttributes,
    agentAttributes
  ]

  this.events.add(event, tx.priority || Math.random())
}

/**
 * Put all the logic for handing finalized transactions off to the tracers and
 * metric collections in one place.
 *
 * @param {Transaction} transaction Newly-finalized transaction.
 */
Agent.prototype._transactionFinished = function _transactionFinished(transaction) {
  // Allow the API to explicitly set the ignored status.
  if (transaction.forceIgnore !== null) {
    transaction.ignore = transaction.forceIgnore
  }

  if (!transaction.ignore) {
    if (transaction.forceIgnore === false) {
      logger.debug('Explicitly not ignoring %s (%s).', transaction.name, transaction.id)
    }
    this.metrics.merge(transaction.metrics)
    this.errors.onTransactionFinished(transaction, this.metrics)
    this.traces.add(transaction)

    var trace = transaction.trace
    trace.intrinsics = transaction.getIntrinsicAttributes()

    this._addEventFromTransaction(transaction)
  } else if (transaction.forceIgnore === true) {
    logger.debug('Explicitly ignoring %s (%s).', transaction.name, transaction.id)
  } else {
    logger.debug('Ignoring %s (%s).', transaction.name, transaction.id)
  }

  --this.activeTransactions
  this.totalActiveSegments -= transaction.numSegments
  this.segmentsClearedInHarvest += transaction.numSegments
}

/**
 * Get the current transaction (if there is one) from the tracer.
 *
 * @returns {Transaction} The current transaction.
 */
Agent.prototype.getTransaction = function getTransaction() {
  return this.tracer.getTransaction()
}

Agent.prototype.recordSupportability = function recordSupportability(name, value) {
  var metric = this.metrics.getOrCreateMetric(NAMES.SUPPORTABILITY.PREFIX + name)
  if (value != null) {
    metric.recordValue(value)
  } else {
    metric.incrementCallCount()
  }
}

Agent.prototype._listenForConfigChanges = function _listenForConfigChanges() {
  var self = this
  this.config.on('apdex_t', this._apdexTChange.bind(this))
  this.config.on('data_report_period', this._harvesterIntervalChange.bind(this))
  this.config.on('agent_enabled', this._enabledChange.bind(this))
  this.config.on('change', this._configChange.bind(this))
  this.config.on('metric_name_rules', function updateMetricNameNormalizer() {
    self.metricNameNormalizer.load.apply(self.metricNameNormalizer, arguments)
  })
  this.config.on('transaction_name_rules', function updateTransactionNameNormalizer() {
    self.transactionNameNormalizer.load.apply(self.transactionNameNormalizer, arguments)
  })
  this.config.on('url_rules', function updateUrlNormalizer() {
    self.urlNormalizer.load.apply(self.urlNormalizer, arguments)
  })
  this.config.on('transaction_segment_terms', function updateSegmentNormalizer() {
    self.txSegmentNormalizer.load.apply(self.txSegmentNormalizer, arguments)
  })
  this.config.on('sampling_target', function updateSamplingTarget(target) {
    self.transactionSampler.samplingTarget = target
  })
  this.config.on(
    'sampling_target_period_in_seconds',
    function updateSamplePeriod(period) {
      self.transactionSampler.samplingPeriod = period * 1000
    }
  )
  this.config.on(
    'transaction_events.max_samples_per_minute',
    function updateEventSampleLimit(maxSamples) {
      self.events.setLimit(maxSamples)
    }
  )
}

module.exports = Agent
