'use strict'

const a = require('async')
const logger = require('./logger').child({component: 'Harvest'})

const FROM_MILLIS = 1e-3
const NAMES = require('./metrics/names')


class Harvest {
  constructor(agent) {
    this.agent = agent

    // Cache references to the data to harvest.
    this._customEvents = agent.customEvents
    this._metrics = agent.metrics
    this._errorEventsQueue = agent.errors.getQueue()
    this._errors = agent.errors.getErrors()
    this._traces = [].concat(agent.traces.syntheticsTraces)
    this._events = this._splitPayload(agent.events)
    this._queries = agent.queries
    this._spanEventsQueue = agent.spans.getQueue()

    // Prepare all our data.
    this._prepareCustomEvents()
    this._prepareErrors()
    this._prepareTraces()
    this._prepareEvents()
    this._prepareSpans()
  }

  send(callback) {
    const self = this

    a.eachOfSeries([
      this._sendMetrics,
      this._sendErrors,
      this._sendTrace,
      this._sendEvents,
      this._sendCustomEvents,
      this._sendQueries,
      this._sendErrorEvents,
      this._sendSpanEvents
    ], function eachHarvestStep(step, i, cb) {
      logger.trace('Doing harvest step %d. %s', i, step.name)
      if (!self.agent.collector.isConnected()) {
        logger.debug('Connection to New Relic lost during harvest.')
        return setImmediate(function immediatelyError() {
          callback(new Error('Not connected to New Relic!'))
        })
      }
      step.call(self, cb)
    }, function afterHarvest(err) {
      if (err) {
        self.mergeUnsentData()
      }
      callback(err)
    })
  }

  mergeUnsentData() {
    if (this._metrics) {
      this.agent.metrics.merge(this._metrics, true)
    }
    if (this._errors) {
      this.agent.errors.mergeErrors(this._errors)
    }
    if (this._errorEventsQueue) {
      this.agent.errors.mergeEvents(this._errorEventsQueue)
    }
    if (this._traces) {
      for (let i = 0; i < this._traces.length; ++i) {
        this.agent.traces.add(this._traces[i].transaction)
      }
    }
    if (this._events) {
      for (let i = 0; i < this._events.length; ++i) {
        if (this._events[i]) {
          this.agent.events.merge(
            this._events[i].toMerge
          )
        }
      }
    }
    if (this._customEvents) {
      this.agent.customEvents.merge(this._customEvents)
    }
    if (this._queries) {
      this.agent.queries.merge(this._queries)
    }
    if (this._spanEventsQueue) {
      this.agent.spans.mergeEvents(this._spanEventsQueue)
    }
  }

  // ------------------------------------------------------------------------ //
  // ------------------------------------------------------------------------ //
  // ------------------------------------------------------------------------ //
  //
  //  ####   ####   ####   ####    ###   ####   ####
  //  #   #  #   #  #      #   #  #   #  #   #  #
  //  ####   ####   ###    ####   #####  ####   ###
  //  #      #   #  #      #      #   #  #   #  #
  //  #      #   #  #####  #      #   #  #   #  #####
  //

  /**
   * Generates metrics related to custom event aggregation.
   */
  _prepareCustomEvents() {
    // Create the metrics so they are at least set to 0
    const dropped = this._metrics.getOrCreateMetric(NAMES.CUSTOM_EVENTS.DROPPED)
    const seen = this._metrics.getOrCreateMetric(NAMES.CUSTOM_EVENTS.SEEN)
    const sent = this._metrics.getOrCreateMetric(NAMES.CUSTOM_EVENTS.SENT)

    // Bail out if there are no events
    if (this._customEvents.length === 0) {
      this._customEvents = null
      return
    }

    if (this.agent.config.custom_insights_events.enabled) {
      // Record their values
      var diff = this._customEvents.overflow()
      dropped.incrementCallCount(diff)
      seen.incrementCallCount(this._customEvents.seen)
      sent.incrementCallCount(this._customEvents.length)

      // Log any warnings about dropping events
      if (diff) {
        logger.warn('Dropped %s custom events out of %s.', diff, this._customEvents.seen)
      }
    } else {
      // We have events and custom events are disabled. Clear everything out so
      // we don't hold onto memory that we shouldn't. Only time this could happen
      // is if the server sent down settings disabling custom events in the
      // middle of a harvest cycle.
      this._customEvents = null
    }
  }

  /**
   * Generates metrics related to error event aggregation.
   */
  _prepareErrors() {
    // Create the metrics so they are at least set to 0
    const dropped = this.agent.metrics.getOrCreateMetric(NAMES.TRANSACTION_ERROR.DROPPED)
    const seen = this.agent.metrics.getOrCreateMetric(NAMES.TRANSACTION_ERROR.SEEN)
    const sent = this.agent.metrics.getOrCreateMetric(NAMES.TRANSACTION_ERROR.SENT)

    // Check for error event information.
    if (this.agent.config.error_collector.capture_events) {
      // Record their values
      const seenCount = this._errorEventsQueue.seen
      seen.incrementCallCount(seenCount)
      sent.incrementCallCount(this._errorEventsQueue.length)

      // Log any warnings about dropping events
      const diff = this._errorEventsQueue.overflow()
      dropped.incrementCallCount(diff)
      if (diff) {
        logger.warn('Dropped %s error events out of %s.', diff, seenCount)
      }
    } else {
      // We have events and error events are disabled. Clear everything out so we
      // don't hold onto memory that we shouldn't. Only time this could happen is
      // if the server sent down settings disabling error events in the middle of
      // a harvest cycle.
      this._errorEventsQueue = null
    }

    // Generate metrics for collected errors.
    const errors = this.agent.errors
    if (errors.getTotalErrorCount() > 0) {
      let count = errors.getTotalErrorCount()
      this._metrics.getOrCreateMetric(NAMES.ERRORS.ALL).incrementCallCount(count)

      count = errors.getWebTransactionsErrorCount()
      this._metrics.getOrCreateMetric(NAMES.ERRORS.WEB).incrementCallCount(count)

      count = errors.getOtherTransactionsErrorCount()
      this._metrics.getOrCreateMetric(NAMES.ERRORS.OTHER).incrementCallCount(count)
    }
  }

  _prepareTraces() {
    const traceAggr = this.agent.traces

    // Plus one other trace.
    if (traceAggr.trace) {
      const max = this.agent.config.max_trace_segments
      if (traceAggr.trace.segmentsSeen > max) {
        logger.warn(
          'transaction %s (%s) contained %d segments, only collecting the first %d',
          traceAggr.trace.transaction.name,
          traceAggr.trace.transaction.id,
          traceAggr.trace.segmentsSeen,
          max
        )
      }
      traceAggr.noTraceSubmitted = 0
      this._traces.push(traceAggr.trace)
    } else {
      ++traceAggr.noTraceSubmitted
      if (traceAggr.noTraceSubmitted >= 5) {
        traceAggr.resetTimingTracker()
      }
    }
  }

  _prepareEvents() {
    const eventAggr = this.agent.events

    // Create the metrics so they are at least set to 0
    const discarded = this.agent.metrics.getOrCreateMetric(NAMES.EVENTS.DISCARDED)
    const seen = this.agent.metrics.getOrCreateMetric(NAMES.EVENTS.SEEN)
    const sent = this.agent.metrics.getOrCreateMetric(NAMES.EVENTS.SENT)

    seen.incrementCallCount(eventAggr.seen)
    sent.incrementCallCount(eventAggr.sent)

    // If we had to limit events and sample them, emit a warning
    const diff = eventAggr.overflow()
    discarded.incrementCallCount(diff)
    if (diff > 0) {
      logger.warn(
        'analytics event overflow, dropped %d events; try increasing your limit above %d',
        diff,
        eventAggr.limit
      )
    }
  }

  _prepareSpans() {
    this._metrics.getOrCreateMetric(NAMES.SPAN_EVENTS.SEEN)
      .incrementCallCount(this._spanEventsQueue.seen)
    this._metrics.getOrCreateMetric(NAMES.SPAN_EVENTS.SENT)
      .incrementCallCount(this._spanEventsQueue.length)
    this._metrics.getOrCreateMetric(NAMES.SPAN_EVENTS.DISCARDED)
      .incrementCallCount(this._spanEventsQueue.overflow())
  }

  // ------------------------------------------------------------------------ //
  // ------------------------------------------------------------------------ //
  // ------------------------------------------------------------------------ //
  //
  //   ###  ####   ##    #  ###
  //  #     #      # #   #  #  #
  //   ##   ###    #  #  #  #   #
  //     #  #      #   # #  #   #
  //  ###   #####  #    ##  ####
  //

  /**
   * @private
   *
   * @param {Function} callback - Gets any delivery errors.
   */
  _sendMetrics(callback) {
    if (this._metrics.empty) {
      logger.debug('No metrics to send.')
      this._metrics = null
      return setImmediate(callback)
    }

    const self = this
    const metrics = this._metrics
    const beginSeconds = metrics.started * FROM_MILLIS
    const endSeconds = Date.now() * FROM_MILLIS
    const payload = [this.agent.config.run_id, beginSeconds, endSeconds, metrics.toJSON()]

    this.agent.collector.metricData(payload, function onMetricData(error, rules) {
      if (error) {
        return callback(error)
      }

      self._metrics = null
      if (rules) {
        self.agent.mapper.load(rules)
      }

      callback()
    })
  }

  /**
   * @private
   *
   * @param {Function} callback Gets any delivery errors.
   */
  _sendErrors(callback) {
    const config = this.agent.config
    if (!config.collect_errors || !config.error_collector.enabled) {
      logger.debug('Error collection disabled.')
      this._errors = null
      return setImmediate(callback)
    }
    if (this._errors.length === 0) {
      logger.debug('No errors to send.')
      this._errors = null
      return setImmediate(callback)
    }

    const self = this
    const payload = [config.run_id, this._errors]
    this.agent.collector.errorData(payload, function onErrorData(error) {
      if (!error) {
        self._errors = null
      }

      callback(error)
    })
  }

  _sendTrace(callback) {
    const config = this.agent.config
    if (!config.collect_traces || !config.transaction_tracer.enabled) {
      logger.debug('Trace collection disabled.')
      this._traces = null
      return setImmediate(callback)
    }
    if (this._traces.length === 0) {
      logger.debug('No traces to send.')
      this._traces = null
      return setImmediate(callback)
    }

    const self = this
    a.map(this._traces, function generateTraceJSON(trace, cb) {
      trace.generateJSON(cb)
    }, function sendEncodedTraces(err, encodedTraces) {
      if (err) {
        logger.error(err, 'Error generating traces for collection!')
        this._traces = null
        return callback(err)
      }

      const payload = [config.run_id, encodedTraces]
      self.agent.collector.transactionSampleData(payload, function afterTraceSent(error) {
        if (!error) {
          ++self.agent.traces.reported
          self._traces = null
        }

        callback(error)
      })
    })
  }

  _sendEvents(callback) {
    if (!this.agent.config.transaction_events.enabled) {
      logger.debug('Event collection disabled.')
      this._events = null
      return setImmediate(callback)
    }
    if (this._events.length === 0) {
      logger.debug('No events to send.')
      this._events = null
      return setImmediate(callback)
    }

    const self = this
    const agent = this.agent
    a.eachOfSeries(this._events, function sendEachPayload(obj, i, cb) {
      const payload = obj.payload
      agent.collector.analyticsEvents(payload, function onAnalyticsEvents(err) {
        if (self._shouldClearData(err, 'events')) {
          self._events[i] = null
        }
        cb(err)
      })
    }, function afterAllSent(err) {
      if (!err) {
        self._events = null
      }
      callback(err)
    })
  }

  _sendCustomEvents(callback) {
    if (!this.agent.config.custom_insights_events.enabled) {
      logger.debug('Custom event collection disabled.')
      this._customEvents = null
      return setImmediate(callback)
    }
    if (!this._customEvents || this._customEvents.length === 0) {
      logger.debug('No custom events to send.')
      this._customEvents = null
      return setImmediate(callback)
    }

    const self = this
    const payload = [
      this.agent.config.run_id,
      this._customEvents.toArray()
    ]

    // Send data to collector
    this.agent.collector.customEvents(payload, function onCustomEvents(err) {
      // TODO: Refactor collector error handling so that the error is passed
      // back. Once that is done, generate FAILED and TOO_LARGE metrics for
      // errors.
      if (self._shouldClearData(err, 'custom events')) {
        self._customEvents = null
      }

      callback(err)
    })
  }

  _sendQueries(callback) {
    if (!this.agent.config.slow_sql.enabled) {
      logger.debug('Slow query collection disabled.')
      this._queries = null
      return setImmediate(callback)
    }
    if (this._queries.samples.size === 0) {
      logger.debug('No queries to send.')
      this._queries = null
      return setImmediate(callback)
    }

    const self = this
    this._queries.prepareJSON(function gotJSON(err, data) {
      if (err) {
        logger.debug(err, 'Error while serializing query data!')
        return callback(err)
      }

      self.agent.collector.queryData([data], function handleResponse(error) {
        if (!error) {
          self._queries = null
        }
        callback(error)
      })
    })
  }

  _sendErrorEvents(callback) {
    const ecConfig = this.agent.config.error_collector
    if (!ecConfig.enabled || !ecConfig.capture_events) {
      logger.debug('Error event collection disabled.')
      this._errorEventsQueue = null
      return setImmediate(callback)
    }
    if (!this._errorEventsQueue || this._errorEventsQueue.length === 0) {
      logger.debug('No error events to send.')
      this._errorEventsQueue = null
      return setImmediate(callback)
    }

    const metrics = {
      reservoir_size: this._errorEventsQueue.limit,
      events_seen: this._errorEventsQueue.seen
    }
    const payload = [
      this.agent.config.run_id,
      metrics,
      this._errorEventsQueue.toArray()
    ]

    // Send data to collector
    const self = this
    this.agent.collector.errorEvents(payload, function onErrorEvents(err) {
      if (self._shouldClearData(err, 'error events')) {
        self._errorEventsQueue = null
      }

      callback(err)
    })
  }

  _sendSpanEvents(callback) {
    const config = this.agent.config
    if (!config.span_events.enabled || !config.distributed_tracing.enabled) {
      logger.debug('Span events collection disabled.')
      this._spanEventsQueues = null
      return setImmediate(callback)
    }
    if (this._spanEventsQueue.length === 0) {
      logger.debug('No span events to send.')
      this._spanEventsQueue = null
      return setImmediate(callback)
    }

    const metrics = {
      reservoir_size: this._spanEventsQueue.limit,
      events_seen: this._spanEventsQueue.seen
    }
    const payload = [
      this.agent.config.run_id,
      metrics,
      this._spanEventsQueue.toArray()
    ]

    const self = this
    this.agent.collector.spanEvents(payload, function onSpanEvents(err) {
      if (self._shouldClearData(err, 'span events')) {
        self._spanEventsQueue = null
      }

      callback(err)
    })
  }

  // ------------------------------------------------------------------------ //
  // ------------------------------------------------------------------------ //
  // ------------------------------------------------------------------------ //

  _shouldClearData(err, name) {
    if (!err) {
      return true
    }

    logger.warn('Failed to send %j; re-sampling.', name)
    return false
  }

  _splitPayload(queue) {
    // If we're less than 1/3 full, don't bother splitting the payload.
    if (queue.length === 0) {
      return []
    }
    if (queue.length < queue.limit / 3) {
      return [{
        toMerge: queue,
        payload: [
          this.agent.config.run_id,
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
        this.agent.config.run_id,
        {reservoir_size: limit, events_seen: seen},
        firstHalf.map(rawEventsToValues)
      ]
    }, {
      toMerge: events,
      payload: [
        this.agent.config.run_id,
        {reservoir_size: queue.limit - limit, events_seen: queue.seen - seen},
        events.map(rawEventsToValues)
      ]
    }]

    function rawEventsToValues(ev) {
      return ev.value
    }
  }
}

module.exports = Harvest
