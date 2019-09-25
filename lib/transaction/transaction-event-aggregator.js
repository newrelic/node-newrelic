'use strict'

const async = require('async')
const logger = require('../logger').child({component: 'transaction-event-aggregator'})
const EventAggregator = require('../aggregators/event-aggregator')

const NAMES = require('../metrics/names')

const SPLIT_THRESHOLD = 5000

class TransactionEventAggregator extends EventAggregator {
  constructor(opts, collector, metrics) {
    opts = opts || {}
    opts.method = opts.method || 'analytic_event_data'
    opts.metricNames = NAMES.EVENTS

    super(opts, collector, metrics)

    this.splitThreshold = opts.splitThreshold || SPLIT_THRESHOLD
  }

  _toPayloadSync() {
    // this is still used by traditional send when payloads not split
    const events = this.events

    if (events.length === 0) {
      logger.debug('No transaction events to send.')
      return
    }

    const metrics = {
      reservoir_size: events.limit,
      events_seen: events.seen
    }

    const eventData = events.toArray()

    return [this.runId, metrics, eventData]
  }

  send() {
    if (this.events.length < this.splitThreshold) {
      return super.send()
    }

    // TODO: log?
    this.emit(`starting ${this.method} data send.`)

    logger.debug('Splitting transaction events into multiple payloads')

    const data = this._getMergeData()

    this.clear()

    const eventPayloadPairs = this._splitData(data)

    this._sendMultiple(eventPayloadPairs, () => {
      // TODO: Log?
      this.emit(`finished ${this.method} data send.`)
    })
  }

  _splitData(data) {
    // TODO: update this to pull the priority off the event when DT is released
    const events = data.getRawEvents()
    const size = Math.floor(data.length / 2)
    const limit = Math.floor(data.limit / 2)
    const seen = Math.floor(data.seen / 2)

    const firstHalfRawEvents = events.splice(0, size)
    const firstMetrics = {
      reservoir_size: limit,
      events_seen: seen
    }
    const firstHalfEventData = firstHalfRawEvents.map(this._rawEventsToValues)
    const firstPayload = [this.runId, firstMetrics, firstHalfEventData]


    const secondHalfRawEvents = events
    const secondMetrics = {
      reservoir_size: data.limit - limit,
      events_seen: data.seen - seen
    }
    const secondHalfEventData = secondHalfRawEvents.map(this._rawEventsToValues)
    const secondPayload = [this.runId, secondMetrics, secondHalfEventData]


    const eventPayloadPairs = [
      { rawData: firstHalfRawEvents, payload: firstPayload },
      { rawData: secondHalfRawEvents, payload: secondPayload}
    ]

    return eventPayloadPairs
  }

  _rawEventsToValues(rawEvent) {
    return rawEvent.value
  }

  _sendMultiple(eventPayloadPairs, sendCallback) {
    const self = this

    // Send payloads one at a time
    async.eachOfSeries(eventPayloadPairs, (payloadPair, index, asyncCallback) => {
      logger.debug(
        'Sending payload %d of %d to %s',
        index + 1,
        eventPayloadPairs.length,
        self.method
      )

      self._sendSplitPayload(payloadPair.rawData, payloadPair.payload, (error) => {
        if (error) {
          logger.warn(error, 'An error occurred sending payload')
        }

        logger.trace(
          'Finished sending payload %d of %d to %s',
          index + 1,
          eventPayloadPairs.length,
          self.method
        )

        // don't pass on error, allow next payload to attempt to send
        asyncCallback()
      })
    }, function afterAllPayloadsSent() {
      logger.debug(
        'Finished sending %d payloads to %s',
        eventPayloadPairs.length,
        self.method
      )

      sendCallback()
    })
  }

  _sendSplitPayload(rawData, payload, callback) {
    this.collector[this.method](payload, (error, response) => {
      if (response && response.retainData) {
        this._merge(rawData)
      }

      callback(error)
    })
  }
}

module.exports = TransactionEventAggregator
