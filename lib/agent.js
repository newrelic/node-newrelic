/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

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
const logger = require('./logger')
const LogAggregator = require('./aggregators/log-aggregator')
const MetricMapper = require('./metrics/mapper')
const MetricNormalizer = require('./metrics/normalizer')
const MetricAggregator = require('./metrics/metric-aggregator')
const NAMES = require('./metrics/names')
const QueryTraceAggregator = require('./db/query-trace-aggregator')
const sampler = require('./sampler')
const TransactionTraceAggregator = require('./transaction/trace/aggregator')
const TransactionEventAggregator = require('./transaction/transaction-event-aggregator')
const Tracer = require('./transaction/tracer')
const TxSegmentNormalizer = require('./metrics/normalizer/tx_segment')
const uninstrumented = require('./uninstrumented')
const util = require('util')
const createSpanEventAggregator = require('./spans/create-span-event-aggregator')
const {
  maybeAddDatabaseAttributes,
  maybeAddExternalAttributes,
  addRequiredCATAttributes,
  maybeAddExtraCATAttributes,
  maybeAddParentAttributes,
  maybeAddQueueAttributes
} = require('./util/attributes')
const synthetics = require('./synthetics')
const Harvester = require('./harvester')
const { createFeatureUsageMetrics } = require('./util/application-logging')
const HealthReporter = require('./health-reporter')

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
 * Indicates that the agent has finished connecting. It is preceded by
 * {@link Agent#event:connecting}.
 *
 * @event Agent#connected
 */

/**
 * Indicates that the agent is in the connecting state. That is, it is
 * communicating with the New Relic data collector and performing requisite
 * operations before the agent is ready to collect and send data.
 *
 * @event Agent#connecting
 */

/**
 * Indicates that the agent has terminated, or lost, its connection to the
 * New Relic data collector.
 *
 * @event Agent#disconnected
 */

/**
 * Indicates that the agent has encountered, or generated, some error that
 * prevents it from operating correctly. The agent state will be set to
 * "errored."
 *
 * @event Agent#errored
 */

/**
 * Indicates that the synchronous harvest cycle has completed. This will be
 * prefaced by the {@link Agent#event:harvestStarted} event. It is only fired
 * in a serverless context.
 *
 * @event Agent#harvestFinished
 */

/**
 * Indicates that a synchronous harvest cycle (collecting data from the various
 * aggregators and sending said data to the New Relic data collector) has
 * started. This is only fired in a serverless context.
 *
 * @event Agent#harvestStarted
 */

/**
 * Indicates that the agent state has entered the "started" state. That is,
 * the agent has finished bootstrapping and is collecting and sending data.
 *
 * @event Agent#started
 */

/**
 * Indicates that the agent is starting. This is typically the first event
 * emitted by the agent.
 *
 * @event Agent#starting
 */

/**
 * Indicates that the agent state has changed to the "stopped" state. That is,
 * the agent is no longer collecting or sending data.
 *
 * @event Agent#stopped
 */

/**
 * Indicates that the agent is entering its shutdown process.
 *
 * @event Agent#stopping
 */

/**
 * Indicates that the transaction has begun recording data.
 *
 * @event Agent#transactionStarted
 * @param {Transaction} currentTransaction
 */

/**
 * Indicates that the transaction has stopped recording data and has been
 * closed.
 *
 * @event Agent#transactionFinished
 * @param {Transaction} currentTransaction
 */

/**
 * There's a lot of stuff in this constructor, due to Agent acting as the
 * orchestrator for New Relic within instrumented applications.
 *
 * This constructor can throw if, for some reason, the configuration isn't
 * available. Don't try to recover here, because without configuration the
 * agent can't be brought up to a useful state.
 *
 * @param {object} config Agent configuration object
 */
function Agent(config) {
  EventEmitter.call(this)

  if (!config) {
    throw new Error('Agent must be created with a configuration!')
  }

  this.healthReporter = new HealthReporter({ agentConfig: config })

  // The agent base attributes which last throughout its lifetime.
  this._state = 'stopped'
  this.config = config
  this.environment = require('./environment')
  this.version = config.version

  if (config.serverless_mode.enabled) {
    this.collector = new ServerlessCollector(this)
  } else {
    this.collector = new CollectorAPI(this)
  }

  this.mapper = new MetricMapper()
  this.metricNameNormalizer = new MetricNormalizer(this.config, 'metric name')
  this.harvester = new Harvester()

  this.metrics = new MetricAggregator(
    {
      periodMs: DEFAULT_HARVEST_INTERVAL_MS,
      apdexT: this.config.apdex_t,
      mapper: this.mapper,
      normalizer: this.metricNameNormalizer
    },
    this.collector,
    this.harvester
  )

  this.metrics.on('starting_data_send-metric_data', this._beforeMetricDataSend.bind(this))

  this.spanEventAggregator = createSpanEventAggregator(config, this)

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
      limit: config.event_harvest_config.harvest_limits.analytic_event_data,
      config,
      enabled: (config) => config.transaction_events.enabled
    },
    this
  )

  this.customEventAggregator = new CustomEventAggregator(
    {
      periodMs: config.event_harvest_config.report_period_ms,
      limit: config.event_harvest_config.harvest_limits.custom_event_data,
      metricNames: NAMES.CUSTOM_EVENTS,
      config,
      enabled: (config) => config.custom_insights_events.enabled
    },
    this
  )

  const errorTraceAggregator = new ErrorTraceAggregator(
    {
      periodMs: DEFAULT_HARVEST_INTERVAL_MS,
      limit: MAX_ERROR_TRACES_DEFAULT,
      config,
      enabled: (config) => config.error_collector.enabled && config.collect_errors
    },
    this.collector,
    this.harvester
  )

  const errorEventAggregator = new ErrorEventAggregator(
    {
      periodMs: config.event_harvest_config.report_period_ms,
      limit: config.event_harvest_config.harvest_limits.error_event_data,
      config,
      enabled: (config) => config.error_collector.enabled && config.error_collector.capture_events
    },
    this
  )

  this.logs = new LogAggregator(
    {
      periodMs: config.event_harvest_config.report_period_ms,
      limit: config.event_harvest_config.harvest_limits.log_event_data,
      config,
      enabled: (config) =>
        config.application_logging.enabled && config.application_logging.forwarding.enabled
    },
    this
  )

  this.errors = new ErrorCollector(config, errorTraceAggregator, errorEventAggregator, this.metrics)

  // Transaction tracing.
  this.tracer = new Tracer(this)
  this.traces = new TransactionTraceAggregator(
    {
      periodMs: DEFAULT_HARVEST_INTERVAL_MS,
      config,
      isAsync: !config.serverless_mode.enabled,
      method: 'transaction_sample_data',
      enabled: (config) => config.transaction_tracer.enabled && config.collect_traces
    },
    this.collector,
    this.harvester
  )
  this.transactionSampler = new AdaptiveSampler({
    agent: this,
    serverless: config.serverless_mode.enabled,
    period: config.sampling_target_period_in_seconds * 1000,
    target: config.sampling_target
  })

  this.queries = new QueryTraceAggregator(
    {
      config,
      periodMs: DEFAULT_HARVEST_INTERVAL_MS,
      method: 'sql_trace_data',
      isAsync: !config.serverless_mode.enabled,
      enabled: (config) => config.slow_sql.enabled
    },
    this.collector,
    this.harvester
  )

  // Set up all the configuration events the agent needs to listen for.
  this._listenForConfigChanges()

  this.initCounters()
  this.llm = {}

  // Finally, add listeners for the agent's own events.
  this.on('transactionFinished', this._transactionFinished.bind(this))
}
util.inherits(Agent, EventEmitter)

/**
 * The agent is meant to only exist once per application, but the singleton is
 * managed by index.js. An agent will be created even if the agent's disabled by
 * the configuration.
 *
 * @param {Function} callback Continuation and error handler.
 * @returns {void}
 *
 * @fires Agent#errored When configuration is not sufficient for operations or
 * cannot establish a connection to the data collector.
 * @fires Agent#starting
 * @fires Agent#stopped When configuration indicates that the agent should be
 * disabled.
 */
Agent.prototype.start = function start(callback) {
  if (!callback) {
    throw new TypeError('callback required!')
  }

  const agent = this

  this.setState('starting')

  if (this.config.agent_enabled !== true) {
    logger.warn('The New Relic Node.js agent is disabled by its configuration. ' + 'Not starting!')

    this.healthReporter.setStatus(HealthReporter.STATUS_AGENT_DISABLED)
    this.setState('stopped')
    return process.nextTick(callback)
  }

  sampler.start(agent)

  if (this.config.serverless_mode.enabled) {
    return this._serverlessModeStart(callback)
  }

  if (!this.config.license_key) {
    logger.error(
      'A valid account license key cannot be found. ' +
        'Has a license key been specified in the agent configuration ' +
        'file or via the NEW_RELIC_LICENSE_KEY environment variable?'
    )
    this.healthReporter.setStatus(HealthReporter.STATUS_LICENSE_KEY_MISSING)

    this.setState('errored')
    sampler.stop()
    return process.nextTick(function onNextTick() {
      agent.healthReporter.stop(() => {
        callback(new Error('Not starting without license key!'))
      })
    })
  }
  logger.info('Starting New Relic for Node.js connection process.')

  this.collector.connect(function onStartConnect(error, response) {
    if (error || response.shouldShutdownRun()) {
      agent.healthReporter.setStatus(HealthReporter.STATUS_CONNECT_ERROR)
      agent.setState('errored')
      sampler.stop()
      callback(error || new Error('Failed to connect to collector'), response && response.payload)
      return
    }

    if (agent.collector.isConnected()) {
      const config = response.payload

      const shouldImmediatelyHarvest = !agent.config.no_immediate_harvest
      agent.onConnect(shouldImmediatelyHarvest, () => {
        callback(null, config)
      })
    } else {
      callback(new Error('Collector did not connect and did not error'))
    }
  })
}

/**
 * Forces all aggregators to send the data collected.
 *
 * @param {Function} callback The callback to invoke when all data types have been sent.
 */
Agent.prototype.forceHarvestAll = function forceHarvestAll(callback) {
  this.harvester.clear(callback)
}

Agent.prototype.startStreaming = function startStreaming() {
  if (this.spanEventAggregator.isStream && this.spanEventAggregator.enabled) {
    this.spanEventAggregator.start()
  }
}

/**
 * Completes any final setup upon full connection to New Relic
 * servers and sets the agent state to 'started'.
 *
 * @param {boolean} shouldImmediatelyHarvest Whether we should immediately schedule a harvest, or wait a cycle
 * @param {Function} callback callback function that executes after harvest completes (now if immediate, otherwise later)
 *
 * @fires Agent#started
 */
Agent.prototype.onConnect = function onConnect(shouldImmediatelyHarvest, callback) {
  this.harvester.update(this.config)
  createFeatureUsageMetrics(this)

  if (this.config.certificates && this.config.certificates.length > 0) {
    this.metrics.getOrCreateMetric(NAMES.FEATURES.CERTIFICATES).incrementCallCount()
  }

  this._scheduleHarvests(shouldImmediatelyHarvest, callback)

  this.setState('started')
}

Agent.prototype._scheduleHarvests = function _scheduleHarvests(shouldImmediatelyHarvest, callback) {
  if (!shouldImmediatelyHarvest) {
    this.harvester.start()
    setImmediate(callback)
    return
  }

  const agent = this

  // For data collection that streams immediately, dont delay capture/sending until
  // the harvest of everything else has completed.
  agent.startStreaming()

  // Harvest immediately for quicker data display, but after at least 1
  // second or the collector will throw away the data.
  //
  // NOTE: this setTimeout is deliberately NOT unref'd due to it being
  // the last step in the Agent startup process
  setTimeout(function afterTimeout() {
    logger.info(`Starting initial ${INITIAL_HARVEST_DELAY_MS}ms harvest.`)

    agent.forceHarvestAll(function afterAllAggregatorsSend() {
      agent.harvester.start()
      callback()
    })
  }, INITIAL_HARVEST_DELAY_MS)
}

/**
 *  Bypasses standard collector connection by immediately invoking the startup
 *  callback, after gathering local environment details.
 *
 * @param {Function} callback Immediately invoked callback
 */
Agent.prototype._serverlessModeStart = function _serverlessModeStart(callback) {
  logger.info('New Relic for Node.js starting in serverless mode -- skipping connection process.')

  setImmediate(() => callback(null, this.config))
}

/**
 * Any memory claimed by the agent will be retained after stopping.
 *
 * FIXME: make it possible to dispose of the agent, as well as do a
 * "hard" restart. This requires working with shimmer to strip the
 * current instrumentation and patch to the module loader.
 *
 * @param {Function} callback callback function to invoke after agent stop
 *
 * @fires Agent#errored When disconnecting from the data collector has resulted
 * in some error.
 * @fires Agent#stopped
 * @fires Agent#stopping
 */
Agent.prototype.stop = function stop(callback) {
  if (!callback) {
    throw new TypeError('callback required!')
  }

  const agent = this

  this.setState('stopping')

  this.harvester.stop()

  sampler.stop()

  this.healthReporter.setStatus(HealthReporter.STATUS_AGENT_SHUTDOWN)
  this.healthReporter.stop(() => {
    if (agent.collector.isConnected()) {
      agent.collector.shutdown(function onShutdown(error) {
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
  })
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
  this.errors.traceAggregator.reconfigure(this.config)
  this.errors.eventAggregator.reconfigure(this.config)
}

/**
 * Resets events.
 */
Agent.prototype._resetEvents = function resetEvents() {
  this.transactionEventAggregator.clear()
}

/**
 * Resets custom events.
 */
Agent.prototype._resetCustomEvents = function resetCustomEvents() {
  this.customEventAggregator.clear()
}

/**
 * This method invokes a harvest synchronously, i.e. sends all data to the
 * New Relic collector in a blocking fashion.
 *
 * NOTE: this doesn't currently work outside serverless mode.
 *
 * @fires Agent#harvestStarted
 * @fires Agent#harvestFinished
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
  this.logs.send()

  // Write serverless output
  collector.flushPayloadSync()

  agent.emit('harvestFinished')
  logger.info('Harvest finished.')
}

Agent.prototype._beforeMetricDataSend = function _beforeMetricDataSend() {
  this._generateEntityStatsAndClear()

  // Send uninstrumented supportability metrics every metric harvest cycle
  uninstrumented.createMetrics(this.metrics)

  if (this.spanEventAggregator.isStream) {
    this.spanEventAggregator.createMetrics()
  }
}

Agent.prototype._generateEntityStatsAndClear = function _generateHarvestMetrics() {
  // Note some information about the size of this harvest.
  if (logger.traceEnabled()) {
    logger.trace(
      {
        segmentTotal: this.totalActiveSegments,
        harvestCreated: this.segmentsCreatedInHarvest,
        harvestCleared: this.segmentsClearedInHarvest,
        activeTransactions: this.activeTransactions
      },
      'Entity stats on metric harvest'
    )
  }

  this.resetCounters()
}

Agent.prototype.initCounters = function initCounters() {
  // Entity tracking metrics.
  this.totalActiveSegments = 0
  this.segmentsCreatedInHarvest = 0
  this.segmentsClearedInHarvest = 0
  // Used by shutdown code as well as entity tracking stats
  this.activeTransactions = 0
}

Agent.prototype.incrementCounters = function incrementCounters() {
  ++this.totalActiveSegments
  ++this.segmentsCreatedInHarvest
}

Agent.prototype.decrementCounters = function decrementCounters(transaction) {
  --this.activeTransactions
  this.totalActiveSegments -= transaction.numSegments
  this.segmentsClearedInHarvest += transaction.numSegments
}

Agent.prototype.resetCounters = function resetCounters() {
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
  if (!configuration) {
    throw new TypeError('must pass configuration')
  }

  this.config.onConnect(configuration)
}

/**
 * Set the current state of the agent. Some states will not allow the
 * creation of Transactions.
 *
 * @param {string} newState The new state of the agent.
 *
 * @fires Agent#connected
 * @fires Agent#connecting
 * @fires Agent#disconnected
 * @fires Agent#errored
 * @fires Agent#started
 * @fires Agent#starting
 * @fires Agent#stopped
 * @fires Agent#stopping
 */
Agent.prototype.setState = function setState(newState) {
  if (!Object.prototype.hasOwnProperty.call(STATES, newState)) {
    throw new TypeError('Invalid state ' + newState)
  }

  logger.info('Agent state changed from %s to %s.', this._state, newState)
  this._state = newState
  this.emit(this._state)
}

/**
 * Return true if the agent is in a run state that can collect and
 * process data.
 *
 * @returns {boolean} Whether or not the agent can collect data in its current state
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

  maybeAddQueueAttributes(transaction, intrinsicAttributes)
  maybeAddExternalAttributes(transaction, intrinsicAttributes)
  maybeAddDatabaseAttributes(transaction, intrinsicAttributes)
  synthetics.assignTransactionAttrs(transaction, intrinsicAttributes)

  if (this.config.distributed_tracing.enabled) {
    transaction.addDistributedTraceIntrinsics(intrinsicAttributes)
    maybeAddParentAttributes(transaction, intrinsicAttributes)
  } else if (
    this.config.cross_application_tracer.enabled &&
    !transaction.invalidIncomingExternalTransaction &&
    (transaction.referringTransactionGuid || transaction.includesOutboundRequests())
  ) {
    addRequiredCATAttributes(transaction, intrinsicAttributes, this.config)
    maybeAddExtraCATAttributes(transaction, intrinsicAttributes, this.config)
  }

  return intrinsicAttributes
}

Agent.prototype._addEventFromTransaction = function _addEventFromTransaction(tx) {
  if (!this.config.transaction_events.enabled) {
    return
  }

  const intrinsicAttributes = this._addIntrinsicAttrsFromTransaction(tx)
  const userAttributes = tx.trace.custom.get(DESTINATIONS.TRANS_EVENT)
  const agentAttributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)

  const event = [intrinsicAttributes, userAttributes, agentAttributes]

  // eslint-disable-next-line sonarjs/pseudo-random
  this.transactionEventAggregator.add(event, tx.priority || Math.random())
}

/**
 * Put all the logic for handing finalized transactions off to the tracers and
 * metric collections in one place.
 *
 * @param {object} transaction Newly-finalized transaction.
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

  this.decrementCounters(transaction)
}

Agent.prototype.setLambdaArn = function setLambdaArn(arn) {
  if (this.collector instanceof ServerlessCollector) {
    this.collector.setLambdaArn(arn)
  }
}

Agent.prototype.setLambdaFunctionVersion = function setLambdaFunctionVersion(functionVersion) {
  if (this.collector instanceof ServerlessCollector) {
    this.collector.setLambdaFunctionVersion(functionVersion)
  }
}

/**
 * Get the current transaction (if there is one) from the tracer.
 *
 * @returns {object} The current transaction.
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
  this.config.on('sampling_target_period_in_seconds', function updateSamplePeriod(period) {
    self.transactionSampler.samplingPeriod = period * 1000
  })
  this.config.on('event_harvest_config', function onHarvestConfigReceived(harvestConfig) {
    if (harvestConfig) {
      generateEventHarvestSupportMetrics(self, harvestConfig)
    }
  })
}

/**
 * This method returns an object with the following keys/data:
 * - `trace.id`: The current trace ID
 * - `span.id`: The current span ID
 *
 * If `excludeServiceLinks` is false it will also include the following:
 * - `entity.name`: The application name specified in the connect request as
 *   app_name. If multiple application names are specified this will only be
 *   the first name
 * - `entity.type`: The string "SERVICE"
 * - `entity.guid`: The entity ID returned in the connect reply as entity_guid
 * - `hostname`: The hostname as specified in the connect request as
 *   utilization.full_hostname. If utilization.full_hostname is null or empty,
 *   this will be the hostname specified in the connect request as host.
 *
 * @param {boolean} excludeServiceLinks flag to indicate if you should include `entity.guid`, `entity.type`, `entity.name` and `hostname` from linking metadata
 * @returns {object} The LinkingMetadata object with the data above
 */
Agent.prototype.getLinkingMetadata = function getLinkingMetadata(excludeServiceLinks = false) {
  const segment = this.tracer.getSegment()
  const transaction = this.tracer.getTransaction()
  const config = this.config

  const linkingMetadata = {}

  if (config.distributed_tracing.enabled && segment && transaction) {
    linkingMetadata['trace.id'] = transaction.traceId
    const spanId = segment.getSpanId()
    if (spanId) {
      linkingMetadata['span.id'] = spanId
    }
  } else {
    logger.debug('getLinkingMetadata with no active transaction')
  }

  if (!excludeServiceLinks) {
    this.getServiceLinkingMetadata(linkingMetadata)
  }

  return linkingMetadata
}

/**
 * This methods returns an object with the following keys/data:
 * - `entity.name`: The application name specified in the connect request as
 *   app_name. If multiple application names are specified this will only be
 *   the first name
 * - `entity.type`: The string "SERVICE"
 * - `entity.guid`: The entity ID returned in the connect reply as entity_guid
 * - `hostname`: The hostname as specified in the connect request as
 *   utilization.full_hostname. If utilization.full_hostname is null or empty,
 *   this will be the hostname specified in the connect request as host.
 *
 * @param {object} linkingMetadata object to add service linking keys
 * @returns {object} with service linking metadata
 */
Agent.prototype.getServiceLinkingMetadata = function getServiceLinkingMetadata(
  linkingMetadata = {}
) {
  const config = this.config
  if (config.entity_guid) {
    linkingMetadata['entity.guid'] = config.entity_guid
  }
  linkingMetadata['entity.name'] = config.applications()[0]
  linkingMetadata['entity.type'] = 'SERVICE'
  linkingMetadata.hostname = config.getHostnameSafe()
  return linkingMetadata
}

/**
 * Formats the NR-LINKING blob that matches the spec
 *
 * @returns {string} formatted NR-LINKING string
 */
Agent.prototype.getNRLinkingMetadata = function getNRLinkingMetadata() {
  const metadata = this.getLinkingMetadata()
  const nrLinkingMeta = [
    getValue('entity.guid'),
    getValue('hostname'),
    getValue('trace.id'),
    getValue('span.id'),
    encodeURIComponent(getValue('entity.name'))
  ]

  return ` NR-LINKING|${nrLinkingMeta.join('|')}|`

  /**
   * Retries value for a given key but defaults to `` if falsey
   *
   * @param {string} key in linking metadata
   * @returns {string} Metadata value or empty string
   */
  function getValue(key) {
    return metadata[key] || ''
  }
}

function generateEventHarvestSupportMetrics(agent, harvestConfig) {
  const harvestLimits = harvestConfig.harvest_limits

  const harvestNames = NAMES.EVENT_HARVEST
  const harvestLimitNames = harvestNames.HARVEST_LIMIT

  const reportPeriodMetric = agent.metrics.getOrCreateMetric(harvestNames.REPORT_PERIOD)
  reportPeriodMetric.recordValue(harvestConfig.report_period_ms)

  const analyticLimit = harvestLimits.analytic_event_data
  if (analyticLimit) {
    const analyticLimitMetric = agent.metrics.getOrCreateMetric(harvestLimitNames.ANALYTIC)
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

  const logLimit = harvestLimits.log_event_data
  if (logLimit) {
    const logLimitMetric = agent.metrics.getOrCreateMetric(harvestLimitNames.LOG)
    logLimitMetric.recordValue(logLimit)
  }
}

module.exports = Agent
