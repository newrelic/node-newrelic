'use strict'

const AdaptiveSampler = require('./adaptive-sampler')
const CollectorAPI = require('./collector/api')
const ServerlessCollector = require('./collector/serverless')
const DESTINATIONS = require('./config/attribute-filter').DESTINATIONS
const CustomEventAggregator = require('./custom-events/custom-event-aggregator')
const ErrorCollector = require('./errors/error-collector')
const ErrorTraceAggregator = require('./errors/error-trace-aggregator')
const ErrorEventAggregator = require('./errors/error-event-aggregator')
const EventEmitter = require('events').EventEmitter
const hashes = require('./util/hashes')
const logger = require('./logger')
const MetricMapper = require('./metrics/mapper')
const MetricNormalizer = require('./metrics/normalizer')
const MetricAggregator = require('./metrics/metric-aggregator')
const NAMES = require('./metrics/names')
const QueryTraceAggregator = require('./db/query-trace-aggregator')
const sampler = require('./sampler')
const TransactionTraceAggregator = require('./transaction/trace/aggregator')
const SpanEventAggregator = require('./spans/span-event-aggregator')
const TransactionEventAggregator = require('./transaction/transaction-event-aggregator')
const Tracer = require('./transaction/tracer')
const TxSegmentNormalizer = require('./metrics/normalizer/tx_segment')
const uninstrumented = require('./uninstrumented')
const util = require('util')

// Map of valid states to whether or not data collection is valid
const STATES = {
  stopped: false,
  starting: true,
  connecting: true,
  connected: true,
  started: true,
  disconnected: false,
  stopping: false,
  errored: false
}

const MAX_ERROR_TRACES_DEFAULT = 20
const INITIAL_HARVEST_DELAY_MS = 1000
const DEFAULT_HARVEST_INTERVAL_MS = 60000

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

  if (config.serverless_mode.enabled) {
    this.collector = new ServerlessCollector(this)
  } else {
    this.collector = new CollectorAPI(this)
  }

  this.mapper = new MetricMapper()
  this.metricNameNormalizer = new MetricNormalizer(this.config, 'metric name')

  this.metrics = new MetricAggregator(
    {
      periodMs: DEFAULT_HARVEST_INTERVAL_MS,
      apdexT: this.config.apdex_t,
      mapper: this.mapper,
      normalizer: this.metricNameNormalizer
    },
    this.collector
  )

  this.metrics.on(
    'starting metric_data data send.',
    this._beforeMetricDataSend.bind(this)
  )

  // Open tracing.
  this.spanEventAggregator = new SpanEventAggregator({
    periodMs: config.event_harvest_config.report_period_ms,
    limit: config.event_harvest_config.harvest_limits.span_event_data
  },
  this.collector,
  this.metrics)

  this.transactionNameNormalizer = new MetricNormalizer(this.config, 'transaction name')
  // Segment term based tx renaming for MGI mitigation.
  this.txSegmentNormalizer = new TxSegmentNormalizer()

  // User naming and ignoring rules.
  this.urlNormalizer = new MetricNormalizer(this.config, 'URL')
  this.userNormalizer = new MetricNormalizer(this.config, 'user')
  this.userNormalizer.loadFromConfig()

  this.transactionEventAggregator = new TransactionEventAggregator(
    {
      periodMs: config.event_harvest_config.report_period_ms,
      limit: config.event_harvest_config.harvest_limits.analytic_event_data
    },
    this.collector,
    this.metrics
  )

  this.customEventAggregator = new CustomEventAggregator(
    {
      periodMs: config.event_harvest_config.report_period_ms,
      limit: config.event_harvest_config.harvest_limits.custom_event_data
    },
    this.collector,
    this.metrics
  )

  const errorTraceAggregator = new ErrorTraceAggregator(
    {
      periodMs: DEFAULT_HARVEST_INTERVAL_MS,
      limit: MAX_ERROR_TRACES_DEFAULT
    },
    this.collector
  )

  const errorEventAggregator =  new ErrorEventAggregator(
    {
      periodMs: config.event_harvest_config.report_period_ms,
      limit: config.event_harvest_config.harvest_limits.error_event_data
    },
    this.collector,
    this.metrics
  )

  this.errors = new ErrorCollector(
    config,
    errorTraceAggregator,
    errorEventAggregator,
    this.metrics
  )

  // Transaction tracing.
  this.tracer = new Tracer(this)
  this.traces = new TransactionTraceAggregator(
    {
      periodMs: DEFAULT_HARVEST_INTERVAL_MS,
      config: this.config,
      isAsync: !config.serverless_mode.enabled,
      method: 'transaction_sample_data'
    },
    this.collector
  )
  this.transactionSampler = new AdaptiveSampler({
    agent: this,
    serverless: config.serverless_mode.enabled,
    period: config.sampling_target_period_in_seconds * 1000,
    target: config.sampling_target
  })

  this.queries = new QueryTraceAggregator(
    {
      config: this.config,
      periodMs: DEFAULT_HARVEST_INTERVAL_MS,
      method: 'sql_trace_data',
      isAsync: !config.serverless_mode.enabled
    },
    this.collector
  )

  // Set up all the configuration events the agent needs to listen for.
  this._listenForConfigChanges()

  // Entity tracking metrics.
  this.totalActiveSegments = 0
  this.segmentsCreatedInHarvest = 0
  this.segmentsClearedInHarvest = 0
  // Used by shutdown code as well as entity tracking stats
  this.activeTransactions = 0

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

  const agent = this

  this.setState('starting')

  if (this.config.agent_enabled !== true) {
    logger.warn('The New Relic Node.js agent is disabled by its configuration. ' +
                'Not starting!')

    this.setState('stopped')
    return process.nextTick(callback)
  }

  sampler.start(agent)

  if (this.config.serverless_mode.enabled) {
    return this._serverlessModeStart(callback)
  }

  if (!this.config.license_key) {
    logger.error('A valid account license key cannot be found. ' +
                 'Has a license key been specified in the agent configuration ' +
                 'file or via the NEW_RELIC_LICENSE_KEY environment variable?')

    this.setState('errored')
    sampler.stop()
    return process.nextTick(function onNextTick() {
      callback(new Error('Not starting without license key!'))
    })
  }
  logger.info('Starting New Relic for Node.js connection process.')

  this.collector.connect(function onStartConnect(error, response) {
    if (error || response.shouldShutdownRun()) {
      agent.setState('errored')
      sampler.stop()
      callback(
        error || new Error('Failed to connect to collector'),
        response && response.payload
      )
      return
    }

    if (agent.collector.isConnected()) {
      agent.onConnect()
      agent.setState('started')
      const config = response.payload

      if (agent.config.no_immediate_harvest) {
        agent.startAggregators()
        callback(null, config)
      } else {
        // Harvest immediately for quicker data display, but after at least 1
        // second or the collector will throw away the data.
        //
        // NOTE: this setTimeout is deliberately NOT unref'd due to it being
        // the last step in the Agent startup process
        setTimeout(function afterTimeout() {
          logger.info(`Starting initial ${INITIAL_HARVEST_DELAY_MS}ms harvest.`)

          agent.forceHarvestAll(function afterAllAggregatorsSend() {
            agent.startAggregators()
            callback(null, config)
          })
        }, INITIAL_HARVEST_DELAY_MS)
      }
    } else {
      callback(new Error('Collector did not connect and did not error'))
    }
  })
}

/**
 * Forces all aggregators to send the data collected.
 * @param {Function} callback The callback to invoke when all data types have been sent.
 */
Agent.prototype.forceHarvestAll = function forceHarvestAll(callback) {
  const agent = this
  const promises = []

  const metricPromise = new Promise((resolve) => {
    agent.metrics.once(
      'finished metric_data data send.',
      function onMetricsFinished() {
        resolve()
      }
    )
    agent.metrics.send()
  })

  promises.push(metricPromise)

  // TODO: plumb config through to aggregators so they can do their own checking.
  if (agent.config.distributed_tracing.enabled &&
      agent.config.span_events.enabled) {
    const spanPromise = new Promise((resolve) => {
      agent.spanEventAggregator.once(
        'finished span_event_data data send.',
        function onSpansFinished() {
          resolve()
        }
      )
      agent.spanEventAggregator.send()
    })

    promises.push(spanPromise)
  }

  if (agent.config.custom_insights_events.enabled) {
    const customEventPromise = new Promise((resolve) => {
      agent.customEventAggregator.once(
        'finished custom_event_data data send.',
        function onCustomEventsFinished() {
          resolve()
        }
      )
      agent.customEventAggregator.send()
    })

    promises.push(customEventPromise)
  }

  if (agent.config.transaction_events.enabled) {
    const transactionEventPromise = new Promise((resolve) => {
      agent.transactionEventAggregator.once(
        'finished analytic_event_data data send.',
        function onTransactionEventsFinished() {
          resolve()
        }
      )
      agent.transactionEventAggregator.send()
    })

    promises.push(transactionEventPromise)
  }

  if (agent.config.transaction_tracer.enabled && agent.config.collect_traces) {
    const transactionTracePromise = new Promise((resolve) => {
      agent.traces.once(
        'finished transaction_sample_data data send.',
        function onTracesFinished() {
          resolve()
        }
      )
      agent.traces.send()
    })

    promises.push(transactionTracePromise)
  }

  if (agent.config.slow_sql.enabled) {
    const sqlTracePromise = new Promise((resolve) => {
      agent.queries.once(
        'finished sql_trace_data data send.',
        function onSqlTracesFinished() {
          resolve()
        }
      )
      agent.queries.send()
    })

    promises.push(sqlTracePromise)
  }

  const errorCollectorEnabled =
    agent.config.error_collector && agent.config.error_collector.enabled

  if (errorCollectorEnabled && agent.config.collect_errors) {
    const errorTracePromise = new Promise((resolve) => {
      agent.errors.traceAggregator.once(
        'finished error_data data send.',
        function onErrorTracesFinished() {
          resolve()
        }
      )
      agent.errors.traceAggregator.send()
    })

    promises.push(errorTracePromise)
  }

  if (errorCollectorEnabled && agent.config.error_collector.capture_events) {
    const errorEventPromise = new Promise((resolve) => {
      agent.errors.eventAggregator.once(
        'finished error_event_data data send.',
        function onErrorEventsFinished() {
          resolve()
        }
      )
      agent.errors.eventAggregator.send()
    })

    promises.push(errorEventPromise)
  }

  Promise.all(promises).then(() => {
    // Get out of the promise so callback errors aren't treated as
    // promise rejections.
    setImmediate(callback)
  })
}

Agent.prototype.stopAggregators = function stopAggregators() {
  this.metrics.stop()
  this.errors.stop()
  this.traces.stop()
  this.queries.stop()
  this.spanEventAggregator.stop()
  this.transactionEventAggregator.stop()
  this.customEventAggregator.stop()
}

Agent.prototype.startAggregators = function startAggregators() {
  this.metrics.start()
  this.errors.start()
  if (this.config.transaction_tracer.enabled && this.config.collect_traces) {
    this.traces.start()
  }

  if (this.config.slow_sql.enabled) {
    this.queries.start()
  }

  if (this.config.distributed_tracing.enabled &&
      this.config.span_events.enabled) {
    this.spanEventAggregator.start()
  }

  if (this.config.transaction_events.enabled) {
    this.transactionEventAggregator.start()
  }

  if (this.config.custom_insights_events.enabled) {
    this.customEventAggregator.start()
  }
}

Agent.prototype.onConnect = function onConnect() {
  this.metrics.reconfigure(this.config)
  this.errors.reconfigure(this.config)
  this.traces.reconfigure(this.config)
  this.queries.reconfigure(this.config)
  this.spanEventAggregator.reconfigure(this.config)
  this.transactionEventAggregator.reconfigure(this.config)
  this.customEventAggregator.reconfigure(this.config)
}

/**
 *  Bypasses standard collector connection by immediately invoking the startup
 *  callback, after gathering local environment details.
 *
 * @param {Function} callback
 */
Agent.prototype._serverlessModeStart = function _serverlessModeStart(callback) {
  logger.info(
    'New Relic for Node.js starting in serverless mode -- skipping connection process.'
  )

  setImmediate(() => callback(null, this.config))
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

  const agent = this

  this.setState('stopping')

  this.stopAggregators()

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
    logger.trace('Collector was not connected, invoking callback.')

    process.nextTick(callback)
  }
}

/**
 * Resets queries.
 */
Agent.prototype._resetQueries = function resetQueries() {
  this.queries.clear()
}

Agent.prototype._resetErrors = function resetErrors() {
  this.errors.clearAll()

  // TODO: is this still necessary?
  // Likely do more direct with new config
  this.errors.reconfigure(this.config)
}

/**
 * Resets events.
 */
Agent.prototype._resetEvents = function resetEvents() {
  this.transactionEventAggregator.clear()
}

/**
 * Resets custom events.
 *
 * @param {boolean} forceReset
 *   Flag signalling unconditional reset, sent during LASP application.
 */
Agent.prototype._resetCustomEvents = function resetCustomEvents() {
  this.customEventAggregator.clear()
}

/**
 * This method invokes a harvest synchronously.
 *
 * NOTE: this doesn't currently work outside of serverless mode.
 */
Agent.prototype.harvestSync = function harvestSync() {
  logger.trace('Peparing to harvest.')

  if (!this.collector.isConnected()) {
    throw new Error('Sync harvest not connected/enabled!')
  }

  // We have a connection, create a new harvest.
  this.emit('harvestStarted')
  logger.info('Harvest started.')

  const collector = this.collector
  const agent = this

  // "Sends" data to the serverless collector collection
  this.metrics.send()
  this.errors.traceAggregator.send()
  this.errors.eventAggregator.send()
  this.traces.send()
  this.queries.send()
  this.spanEventAggregator.send()
  this.transactionEventAggregator.send()
  this.customEventAggregator.send()

  // Write serverless output
  collector.flushPayloadSync()

  agent.emit('harvestFinished')
  logger.info('Harvest finished.')
}

Agent.prototype._beforeMetricDataSend = function _beforeMetricDataSend() {
  this._generateEntityStatsAndClear()

  // Send uninstrumented supportability metrics every metric harvest cycle
  uninstrumented.createMetrics(this.metrics)
}

Agent.prototype._generateEntityStatsAndClear = function _generateHarvestMetrics() {
  // Note some information about the size of this harvest.
  if (logger.traceEnabled()) {
    logger.trace({
      segmentTotal: this.totalActiveSegments,
      harvestCreated: this.segmentsCreatedInHarvest,
      harvestCleared: this.segmentsClearedInHarvest,
      activeTransactions: this.activeTransactions
    }, 'Entity stats on metric harvest')
  }

  // Reset the counters.
  this.segmentsCreatedInHarvest = 0
  this.segmentsClearedInHarvest = 0
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
 * Set the current state of the agent. Some states will not allow the
 * creation of Transactions.
 *
 * @param {string} newState The new state of the agent.
 */
Agent.prototype.setState = function setState(newState) {
  if (!STATES.hasOwnProperty(newState)) {
    throw new TypeError('Invalid state ' + newState)
  }

  logger.info('Agent state changed from %s to %s.', this._state, newState)
  this._state = newState
  this.emit(this._state)
}

/**
 * Return true if the agent is in a run state that can collect and
 * process data.
 */
Agent.prototype.canCollectData = function canCollectData() {
  return STATES[this._state]
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
  const intrinsicAttributes = {
    webDuration: transaction.timer.getDurationInMillis() / 1000,
    timestamp: transaction.timer.start,
    name: transaction.getFullName(),
    duration: transaction.timer.getDurationInMillis() / 1000,
    totalTime: transaction.trace.getTotalTimeDurationInMillis() / 1000,
    type: 'Transaction',
    error: transaction.hasErrors()
  }

  let metric = transaction.metrics.getMetric(NAMES.QUEUETIME)
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

  if (this.config.distributed_tracing.enabled) {
    transaction.addDistributedTraceIntrinsics(intrinsicAttributes)
    if (transaction.parentSpanId) {
      intrinsicAttributes.parentSpanId = transaction.parentSpanId
    }

    if (transaction.parentId) {
      intrinsicAttributes.parentId = transaction.parentId
    }
  } else if (
    this.config.cross_application_tracer.enabled &&
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

  const intrinsicAttributes = this._addIntrinsicAttrsFromTransaction(tx)
  const userAttributes = tx.trace.custom.get(DESTINATIONS.TRANS_EVENT)
  const agentAttributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)

  const event = [
    intrinsicAttributes,
    userAttributes,
    agentAttributes
  ]

  this.transactionEventAggregator.add(event, tx.priority || Math.random())
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
    this.metrics.merge(transaction.metrics, false)

    this.errors.onTransactionFinished(transaction)

    this.traces.add(transaction)

    const trace = transaction.trace
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

Agent.prototype.setLambdaArn = function setLambdaArn(arn) {
  if (this.collector instanceof ServerlessCollector) {
    this.collector.setLambdaArn(arn)
  }
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
  const metric = this.metrics.getOrCreateMetric(NAMES.SUPPORTABILITY.PREFIX + name)
  if (value != null) {
    metric.recordValue(value)
  } else {
    metric.incrementCallCount()
  }
}

Agent.prototype._listenForConfigChanges = function _listenForConfigChanges() {
  const self = this
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
  this.config.on('event_harvest_config', function onHarvestConfigReceived(harvestConfig) {
    if (harvestConfig) {
      generateEventHarvestSupportMetrics(self, harvestConfig)
    }
  })
}

function generateEventHarvestSupportMetrics(agent, harvestConfig) {
  const harvestLimits = harvestConfig.harvest_limits

  const harvestNames = NAMES.EVENT_HARVEST
  const harvestLimitNames = harvestNames.HARVEST_LIMIT

  const reportPeriodMetric = agent.metrics.getOrCreateMetric(harvestNames.REPORT_PERIOD)
  reportPeriodMetric.recordValue(harvestConfig.report_period_ms)

  const analyticLimit = harvestLimits.analytic_event_data
  if (analyticLimit) {
    const analyticLimitMetric = agent.metrics.getOrCreateMetric(
      harvestLimitNames.ANALYTIC
    )
    analyticLimitMetric.recordValue(analyticLimit)
  }

  const customLimit = harvestLimits.custom_event_data
  if (customLimit) {
    const customLimitMetric = agent.metrics.getOrCreateMetric(harvestLimitNames.CUSTOM)
    customLimitMetric.recordValue(customLimit)
  }

  const errorLimit = harvestLimits.error_event_data
  if (errorLimit) {
    const errorLimitMetric = agent.metrics.getOrCreateMetric(harvestLimitNames.ERROR)
    errorLimitMetric.recordValue(errorLimit)
  }

  const spanLimit = harvestLimits.span_event_data
  if (spanLimit) {
    const spanLimitMetric = agent.metrics.getOrCreateMetric(harvestLimitNames.SPAN)
    spanLimitMetric.recordValue(spanLimit)
  }
}

module.exports = Agent
