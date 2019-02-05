'use strict'

const a = require('async')
const CollectorResponse = require('./collector/response')
const logger = require('./logger').child({component: 'Harvest'})

const FROM_MILLIS = 1e-3
const NAMES = require('./metrics/names')

/**
 * Collects, formats, and cleans up data for a single harvest endpoint.
 *
 * @private
 */
class HarvestStep {
  constructor(harvest, endpoint, datasource) {
    this.harvest = harvest
    this.success = false
    this.datasource = datasource
    this.result = null
    this.returned = null
    this._endpoint = endpoint
    this._payloads = null
  }

  get agent() {
    return this.harvest.agent
  }

  get name() {
    return this._endpoint
  }

  /**
   * Assembles the payloads to be sent to the collector.
   *
   * @abstract
   * @protected
   */
  preparePayloads(runId, datasource, callback) { // eslint-disable-line no-unused-vars
    callback(null, this.preparePayloadsSync(runId, datasource))
  }

  /**
   * Synchronously assembles the payloads to be sent to the collector.
   *
   * @abstract
   * @protected
   */
  preparePayloadsSync(runId, datasource) { // eslint-disable-line no-unused-vars
    throw new Error(
      'Synchronous payload preparation not implemented for ' + this._endpoint
    )
  }

  /**
   * Merges the indicated payload back into the aggregator for future collection.
   *
   * @abstract
   * @protected
   */
  mergePayload(payload, idx) { // eslint-disable-line no-unused-vars
    throw new Error('Payload merging not implemented for ' + this._endpoint)
  }

  /**
   * When the datasource is an `EventAggregator`, this method will generate
   * metrics around how many were seen and will be sent.
   *
   * @protected
   *
   * @param {string} metrics.SEEN     - The name of the events seen metric.
   * @param {string} metrics.SENT     - The name of the events sent metric.
   * @param {string} metrics.DROPPED  - The name of the events dropped metric.
   */
  createSamplerMetrics(metrics) {
    // Create all the metrics.
    const seenMetric = this.agent.metrics.getOrCreateMetric(metrics.SEEN)
    const sentMetric = this.agent.metrics.getOrCreateMetric(metrics.SENT)
    const droppedMetric = this.agent.metrics.getOrCreateMetric(metrics.DROPPED)

    // Calculate our seen/sent/dropped counts and record them.
    const seen = this.datasource.seen
    const sent = this.datasource.length
    const dropped = seen - sent
    seenMetric.incrementCallCount(seen)
    sentMetric.incrementCallCount(sent)
    droppedMetric.incrementCallCount(dropped)

    // If we dropped any, let the customer know.
    if (dropped) {
      logger.warn('Dropped %d of %d datapoints for %s.', dropped, seen, this._endpoint)
      logger.warn('You may want to increase the limits for this event type.')
    }
  }

  /**
   * Gets the harvest step ready to send.
   */
  prepare(callback) {
    if (!this.datasource || this.datasource.length === 0) {
      logger.debug('No data to send to %s', this._endpoint)
      return setImmediate(callback)
    }

    this.preparePayloads(this.agent.config.run_id, this.datasource, (err, payloads) => {
      if (err) {
        logger.debug('Failed to prepare payloads for %s', this._endpoint)
      }
      this._payloads = payloads
      callback(err)
    })
  }

  /**
   * Synchronously gets the harvest step ready to send.
   */
  prepareSync() {
    if (!this.datasource || this.datasource.length === 0) {
      logger.debug('No data to send to %s', this._endpoint)
      return
    }

    try {
      this._payloads = this.preparePayloadsSync(this.agent.config.run_id, this.datasource)
      return this._payloads
    } catch (err) {
      logger.debug('Failed to prepare payloads for %s', this._endpoint)
    }
  }

  /**
   * Sends all prepared payloads to the collector.
   */
  send(callback) {
    if (!this._payloads) {
      logger.debug('Payloads were not generated for %s', this._endpoint)
      return setImmediate(callback)
    }

    // Send each of the payloads in series.
    const self = this
    a.eachOfSeries(self._payloads, function sendEachPayload(payload, i, cb) {
      logger.trace(
        'Sending payload %d of %d to %s',
        i + 1,
        self._payloads.length,
        self._endpoint
      )

      // Send the payload to the collector.
      self._doSend(payload, i, cb)
    }, function afterSendingAllPayloads(err) {
      if (!err) {
        self.success = true
      }
      callback(err)
    })
  }

  /**
   * Performs actual payload sending and retrying.
   *
   * @private
   */
  _doSend(payload, i, callback) {
    const self = this
    self._trySend(payload, function afterSend(err, response) {
      if (err) {
        return callback(err)
      }

      // Are we clearing our data?
      if (!response.retainData) {
        self._payloads[i] = null
      } else {
        logger.info('Failed to submit data to New Relic, data held for redelivery.')
      }

      // Do we need to retry this endpoint right now?
      if (response.retryAfter) {
        const delay = response.retryAfter
        logger.debug('Retrying sending to %s in %d ms', self._endpoint, delay)
        setTimeout(() => self._doSend(payload, i, callback), delay)
        return
      }

      // Done!
      self.result = response
      self.payload = response.payload
      callback()
    })
  }

  _trySend(payload, callback) {
    try {
      this.agent.collector[this._endpoint](payload, callback)
    } catch (err) {
      logger.warn(err, 'Failed to call collector method %s', this._endpoint)
      callback(err)
    }
  }

  /**
   * Finishes the harvest step, performing any final cleanup steps.
   */
  finalize(callback) {
    if (this._payloads) {
      this._payloads.forEach((payload, idx) => {
        if (payload) {
          this.mergePayload(payload, idx)
        }
      })
    }

    setImmediate(callback)
  }
}

// -------------------------------------------------------------------------- //

class CustomEventsHarvest extends HarvestStep {
  constructor(harvest) {
    super(harvest, 'customEvents', harvest.agent.customEvents)
    this.createSamplerMetrics(NAMES.CUSTOM_EVENTS)
  }

  preparePayloadsSync(runId, customEvents) {
    if (!customEvents || !customEvents.length) {
      logger.debug('No custom events to send.')
      return []
    }

    return [[runId, customEvents.toArray()]]
  }

  mergePayload() {
    this.agent.customEvents.merge(this.datasource)
  }
}

// -------------------------------------------------------------------------- //

class ErrorEventHarvest extends HarvestStep {
  constructor(harvest) {
    super(harvest, 'errorEvents', harvest.agent.errors.getQueue())
    this.createSamplerMetrics(NAMES.TRANSACTION_ERROR)
  }

  preparePayloadsSync(runId, errorQueue) {
    if (!errorQueue || !errorQueue.length) {
      logger.debug('No error events to send.')
      return []
    }

    const metrics = {
      reservoir_size: errorQueue.limit,
      events_seen: errorQueue.seen
    }
    return [[runId, metrics, errorQueue.toArray()]]
  }

  mergePayload() {
    this.agent.errors.mergeEvents(this.datasource)
  }
}

// -------------------------------------------------------------------------- //

class ErrorTraceHarvest extends HarvestStep {
  constructor(harvest) {
    const errorAggr = harvest.agent.errors
    super(harvest, 'errorData', errorAggr.getErrors())

    // Generate metrics for collected errors.
    if (errorAggr.getTotalErrorCount() > 0) {
      const metrics = harvest.agent.metrics
      let count = errorAggr.getTotalErrorCount()
      metrics.getOrCreateMetric(NAMES.ERRORS.ALL).incrementCallCount(count)

      count = errorAggr.getWebTransactionsErrorCount()
      metrics.getOrCreateMetric(NAMES.ERRORS.WEB).incrementCallCount(count)

      count = errorAggr.getOtherTransactionsErrorCount()
      metrics.getOrCreateMetric(NAMES.ERRORS.OTHER).incrementCallCount(count)
    }
  }

  preparePayloadsSync(runId, errors) {
    if (!errors || !errors.length) {
      logger.debug('No error traces to send.')
      return []
    }
    return [[runId, errors]]
  }

  mergePayload() {
    this.agent.errors.mergeErrors(this.datasource)
  }
}

// -------------------------------------------------------------------------- //

class MetricsHarvest extends HarvestStep {
  constructor(harvest) {
    super(harvest, 'metricData', harvest.agent.metrics)
    this._beginSeconds = harvest.agent.metrics.started * FROM_MILLIS
    this._endSeconds = Date.now() * FROM_MILLIS
  }

  preparePayloadsSync(runId, metrics) {
    if (!metrics || metrics.empty) {
      logger.debug('No metrics to send.')
      return []
    }

    return [[runId, this._beginSeconds, this._endSeconds, metrics.toJSON()]]
  }

  mergePayload() {
    this.agent.metrics.merge(this.datasource, true)
  }

  finalize(callback) {
    // The collector may send back metric naming rules for us to load.
    if (this.payload) {
      this.agent.mapper.load(this.payload)
    }

    super.finalize(callback)
  }
}

// -------------------------------------------------------------------------- //

class QueryHarvest extends HarvestStep {
  constructor(harvest) {
    super(harvest, 'queryData', harvest.agent.queries)
  }

  preparePayloads(runId, queries, callback) {
    if (!queries || !queries.samples.size) {
      logger.debug('No queries to send.')
      return setImmediate(callback, null, [])
    }

    queries.prepareJSON((err, data) => callback(err, [[data]]))
  }

  preparePayloadsSync(runId, queries) {
    if (!queries || !queries.samples.size) {
      logger.debug('No queries to send.')
      return []
    }

    return [[queries.prepareJSONSync()]]
  }

  mergePayload() {
    this.agent.queries.merge(this.datasource)
  }
}

// -------------------------------------------------------------------------- //

class SpanEventHarvest extends HarvestStep {
  constructor(harvest) {
    super(harvest, 'spanEvents', harvest.agent.spans.getQueue())
    this.createSamplerMetrics(NAMES.SPAN_EVENTS)
  }

  preparePayloadsSync(runId, spanQueue) {
    if (!spanQueue || !spanQueue.length) {
      logger.debug('No span events to send.')
      return []
    }

    const metrics = {
      reservoir_size: spanQueue.limit,
      events_seen: spanQueue.seen
    }
    return [[runId, metrics, spanQueue.toArray()]]
  }

  mergePayload() {
    this.agent.spans.mergeEvents(this.datasource)
  }
}

// -------------------------------------------------------------------------- //

class TransactionEventHarvest extends HarvestStep {
  constructor(harvest) {
    super(harvest, 'analyticsEvents', harvest.agent.events)
    this.createSamplerMetrics(NAMES.EVENTS)
    this._mergeablePayloads = []
  }
  preparePayloadsSync(runId, events) {
    if (!events || !events.length) {
      logger.debug('No transaction events to send.')
      return []
    }

    const splits = _splitPayload(runId, events)
    const payloads = []
    splits.forEach((split) => {
      this._mergeablePayloads.push(split.toMerge)
      payloads.push(split.payload)
    })
    return payloads
  }

  mergePayload(payload, idx) {
    if (this._mergeablePayloads[idx]) {
      this.agent.events.merge(this._mergeablePayloads[idx])
      this._mergeablePayloads[idx] = null
    } else {
      logger.debug('Invalid idx (%d) provided for merging transaction events.', idx)
    }
  }
}

// -------------------------------------------------------------------------- //

class TransactionTraceHarvest extends HarvestStep {
  constructor(harvest) {
    const traceAggr = harvest.agent.traces
    const maxTraceSegments = harvest.agent.config.max_trace_segments
    const traces =  [].concat(traceAggr.syntheticsTraces)

    if (traceAggr.trace) {
      const trace = traceAggr.trace
      if (trace.segmentsSeen > maxTraceSegments) {
        logger.warn(
          'Transaction %s (%s) contained %d segments, only collecting the first %d',
          trace.transaction.name,
          trace.transaction.id,
          trace.segmentsSeen,
          maxTraceSegments
        )
      }
      traceAggr.noTraceSubmitted = 0
      traces.push(trace)
    } else if (++traceAggr.noTraceSubmitted >= 5) {
      traceAggr.resetTimingTracker()
    }

    super(harvest, 'transactionSampleData', traces)
    this._traces = traces
  }

  preparePayloads(runId, traces, callback) {
    if (!traces.length) {
      logger.debug('No transaction traces to send.')
      return setImmediate(callback, null, [])
    }

    a.map(
      traces,
      (trace, cb) => trace.generateJSON(cb),
      (err, encodedTraces) => callback(err, [[runId, encodedTraces]])
    )
  }

  preparePayloadsSync(runId, traces) {
    if (!traces.length) {
      logger.debug('No transaction traces to send.')
      return []
    }

    return [[
      runId,
      traces.map((trace) => trace.generateJSONSync())
    ]]
  }

  mergePayload() {
    if (this._traces) {
      for (let i = 0; i < this._traces.length; ++i) {
        this.agent.traces.add(this._traces[i].transaction)
      }
    } else {
      logger.debug('No transaction traces to merge back.')
    }
  }

  finalize(callback) {
    if (this.success) {
      ++this.agent.traces.reported
    }
    super.finalize(callback)
  }
}

// -------------------------------------------------------------------------- //

/**
 * Sequences harvest steps and manages the harvest cycle.
 *
 * @private
 */
class Harvest {
  constructor(agent) {
    this.agent = agent
    this.startTime = Date.now()
    this._steps = Object.create(null)
  }

  static get ALL_ENDPOINTS() {
    return {
      customEvents: true,
      metrics: true,
      errorEvents: true,
      errorTraces: true,
      transactionTraces: true,
      transactionEvents: true,
      queries: true,
      spanEvents: true
    }
  }

  /**
   * Assembles all the harvest steps that this harvest will perform.
   *
   *
   * @param {object.<string,bool>} endpoints
   *  A map indicating all the endpoints that
   */
  prepare(endpoints) {
    // Fetch references to configuration pieces to simplify checks below.
    const config = this.agent.config
    const ecConfig = config.error_collector

    // Create steps for each of the requested endpoints.
    if (endpoints.customEvents && config.custom_insights_events.enabled) {
      this._steps.customEvents = new CustomEventsHarvest(this)
    }

    if (endpoints.metrics) {
      this._steps.metrics = new MetricsHarvest(this)
    }

    if (endpoints.errorEvents && ecConfig.enabled && ecConfig.capture_events) {
      this._steps.errorEvents = new ErrorEventHarvest(this)
    }
    if (endpoints.errorTraces && config.collect_errors && ecConfig.enabled) {
      this._steps.errorTraces = new ErrorTraceHarvest(this)
    }
    if (
      endpoints.transactionTraces &&
      config.collect_traces &&
      config.transaction_tracer.enabled
    ) {
      this._steps.transactionTraces = new TransactionTraceHarvest(this)
    }
    if (endpoints.transactionEvents && config.transaction_events.enabled) {
      this._steps.transactionEvents = new TransactionEventHarvest(this)
    }
    if (endpoints.queries && config.slow_sql.enabled) {
      this._steps.queries = new QueryHarvest(this)
    }
    if (
      endpoints.spanEvents &&
      config.span_events.enabled &&
      config.distributed_tracing.enabled
    ) {
      this._steps.spanEvents = new SpanEventHarvest(this)
    }

    if (logger.traceEnabled()) {
      logger.trace(endpoints, 'Harvesting %j', Object.keys(this._steps))
    }
  }

  send(callback) {
    const self = this

    a.map(this._steps, function eachHarvestStep(step, cb) {
      logger.trace('Doing harvest step %s.', step.name)
      if (!self.agent.collector.isConnected()) {
        logger.debug('Connection to New Relic lost during harvest.')
        return setImmediate(callback, new Error('Not connected to New Relic!'))
      }
      a.series([
        step.prepare.bind(step),
        step.send.bind(step)
      ], function afterHarvestStep(err) {
        step.finalize(function afterFinalize(finalizeErr) {
          // log finalize errors as may be hidden by errors in other steps
          // and errors during finalize might result in incorrect data retention
          if (finalizeErr) {
            logger.warn(finalizeErr, 'Error during finalize of harvest step.')
          }

          cb(null, {
            error: err || finalizeErr || null,
            agentRun: step.result && step.result.agentRun
          })
        })
      })
    }, function afterAllHarvestSteps(err, results) {
      const BEHAVIOR = CollectorResponse.AGENT_RUN_BEHAVIOR
      let agentRunAction = BEHAVIOR.PRESERVE

      if (err) {
        // Any runtime errors should preserve the agent run.
        callback(err, agentRunAction)
        return
      }

      // Pull out and log any errors from harvest steps.
      const errors = results.map((r) => r.error).filter((e) => !!e)
      if (errors.length > 0) {
        logger.warn({errors}, 'Errors during harvest!')
      }

      // See if any endpoints told us to shutdown or restart. A shutdown trumps
      // everything, restart just trumps a preserve.
      for (let i = 0; i < results.length; ++i) {
        const agentRun = results[i].agentRun
        if (agentRun === BEHAVIOR.SHUTDOWN) {
          agentRunAction = BEHAVIOR.SHUTDOWN
          break
        } else if (agentRun === BEHAVIOR.RESTART) {
          agentRunAction = BEHAVIOR.RESTART
        }
      }

      callback(errors[0], agentRunAction)
    })
  }

  getPayloads() {
    const stepNames = Object.keys(this._steps)
    const harvest = this
    // This will only grab the first payload in a split payload case
    return stepNames.reduce(function processStep(processedSteps, name) {
      const payload = harvest._steps[name].prepareSync()
      if (payload) {
        processedSteps[name] = payload[0]
      }
      return processedSteps
    }, Object.create(null))
  }
}

function _splitPayload(runId, queue) {
  // If we're less than 1/3 full, don't bother splitting the payload.
  if (queue.length === 0) {
    return []
  }
  if (queue.length < queue.limit / 3) {
    return [{
      toMerge: queue,
      payload: [
        runId,
        {reservoir_size: queue.limit, events_seen: queue.seen},
        queue.toArray()
      ]
    }]
  }

  // Our payload is large, so split it in half.
  // TODO: update this to pull the priority off the event when DT is released
  const events = queue.getRawEvents()
  const size = Math.floor(queue.length / 2)
  const limit = Math.floor(queue.limit / 2)
  const seen = Math.floor(queue.seen / 2)
  const firstHalf = events.splice(0, size)

  return [{
    toMerge: firstHalf,
    payload: [
      runId,
      {reservoir_size: limit, events_seen: seen},
      firstHalf.map(rawEventsToValues)
    ]
  }, {
    toMerge: events,
    payload: [
      runId,
      {reservoir_size: queue.limit - limit, events_seen: queue.seen - seen},
      events.map(rawEventsToValues)
    ]
  }]

  function rawEventsToValues(ev) {
    return ev.value
  }
}

module.exports = Harvest
