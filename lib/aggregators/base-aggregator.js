/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const EventEmitter = require('events').EventEmitter
const logger = require('../logger').child({ component: 'base_aggregator' })

/**
 * Triggered when the aggregator has finished sending data to the
 * `analytic_event_data` collector endpoint.
 *
 * @event Aggregator#finished_data_send-analytic_event_data
 */

/**
 * Triggered when an aggregator is sending data to the `analytic_event_data`
 * collector endpoint.
 *
 * @event Aggregator#starting_data_send-analytic_event_data
 */

/**
 * Triggered when the aggregator has finished sending data to the
 * `custom_event_data` collector endpoint.
 *
 * @event Aggregator#finished_data_send-custom_event_data
 */

/**
 * Triggered when an aggregator is sending data to the `custom_event_data`
 * collector endpoint.
 *
 * @event Aggregator#starting_data_send-custom_event_data
 */

/**
 * Triggered when the aggregator has finished sending data to the
 * `error_data` collector endpoint.
 *
 * @event Aggregator#finished_data_send-error_data
 */

/**
 * Triggered when an aggregator is sending data to the `error_data`
 * collector endpoint.
 *
 * @event Aggregator#starting_data_send-error_data
 */

/**
 * Triggered when the aggregator has finished sending data to the
 * `error_event_data` collector endpoint.
 *
 * @event Aggregator#finished_data_send-error_event_data
 */

/**
 * Triggered when an aggregator is sending data to the `error_event_data`
 * collector endpoint.
 *
 * @event Aggregator#starting_data_send-error_event_data
 */

/**
 * Triggered when the aggregator has finished sending data to the
 * `log_event_data` collector endpoint.
 *
 * @event Aggregator#finished_data_send-log_event_data
 */

/**
 * Triggered when an aggregator is sending data to the `log_event_data`
 * collector endpoint.
 *
 * @event Aggregator#starting_data_send-log_event_data
 */

/**
 * Triggered when the aggregator has finished sending data to the
 * `metric_data` collector endpoint.
 *
 * @event Aggregator#finished_data_send-metric_data
 */

/**
 * Triggered when an aggregator is sending data to the `metric_data`
 * collector endpoint.
 *
 * @event Aggregator#starting_data_send-metric_data
 */

/**
 * Triggered when the aggregator has finished sending data to the
 * `span_event_data` collector endpoint.
 *
 * @event Aggregator#finished_data_send-span_event_data
 */

/**
 * Triggered when an aggregator is sending data to the `span_event_data`
 * collector endpoint.
 *
 * @event Aggregator#starting_data_send-span_event_data
 */

/**
 * Triggered when the aggregator has finished sending data to the
 * `sql_trace_data` collector endpoint.
 *
 * @event Aggregator#finished_data_send-sql_trace_data
 */

/**
 * Triggered when an aggregator is sending data to the `sql_trace_data`
 * collector endpoint.
 *
 * @event Aggregator#starting_data_send-sql_trace_data
 */

/**
 * Triggered when the aggregator has finished sending data to the
 * `transaction_sample_data` collector endpoint.
 *
 * @event Aggregator#finished_data_send-transaction_sample_data
 */

/**
 * Triggered when an aggregator is sending data to the `transaction_sample_data`
 * collector endpoint.
 *
 * @event Aggregator#starting_data_send-transaction_sample_data
 */

/**
 * Baseline data aggregator that is used to ship data to the New Relic
 * data collector. Specific data aggregators, e.g. an errors aggregator,
 * extend this base object.
 *
 * Aggregators fire of several events. The events are named according to the
 * pattern `<finished|starting>_data_send-<endpoint_name>`. As an example,
 * if the aggregator is collecting data to send to the `error_event_data`
 * endpoint, there will be two events:
 *
 * + `starting_data_send-error_event_data`
 * + `finished_data_send-error_event_data`
 *
 * For a list of possible endpoints, see
 * {@link https://source.datanerd.us/agents/agent-specs/tree/main/endpoints/protocol-version-17}.
 *
 * Note: effort has been made to document the events for every endpoint this
 * agent interacts with, but due to the dynamic nature of the event names we
 * may have missed some.
 */
class Aggregator extends EventEmitter {
  constructor(opts, collector, harvester) {
    super()

    this.defaultPeriod = this.periodMs = opts.periodMs
    this.defaultLimit = this.limit = opts.limit
    this.runId = opts.runId
    this.isAsync = opts.isAsync || false
    // function to pass in to determine if we can start a given aggregator
    this.isEnabled =
      opts.enabled ||
      function defaultEnabled() {
        return true
      }
    this.enabled = this.isEnabled(opts.config)

    /**
     * The name of the collector endpoint that the
     * aggregator will communicate with.
     *
     * @see https://source.datanerd.us/agents/agent-specs/tree/main/endpoints/protocol-version-17
     *
     * @type {string}
     * @memberof Aggregator
     */
    this.method = opts.method
    this.collector = collector
    this.sendTimer = null
    harvester.add(this)
  }

  get enabled() {
    return this._enabled
  }

  set enabled(condition) {
    this._enabled = condition
  }

  start() {
    logger.trace(`${this.method} aggregator started.`)

    if (!this.sendTimer) {
      this.sendTimer = setInterval(this.send.bind(this), this.periodMs)
      this.sendTimer.unref()
    }
  }

  stop() {
    if (this.sendTimer) {
      clearInterval(this.sendTimer)
      this.sendTimer = null

      logger.trace(`${this.method} aggregator stopped.`)
    }
  }

  _merge() {
    throw new Error('merge is not implemented')
  }

  add() {
    throw new Error('add is not implemented')
  }

  _toPayload(callback) {
    try {
      callback(null, this._toPayloadSync())
    } catch (err) {
      callback(err)
    }
  }

  _toPayloadSync() {
    throw new Error('toPayloadSync is not implemented')
  }

  _getMergeData() {
    throw new Error('getData is not implemented')
  }

  clear() {
    throw new Error('clear not implemented')
  }

  _afterSend() {
    // private hook called after send is finished
  }

  _runSend(data, payload) {
    if (!payload) {
      this._afterSend(false)
      this.emit(`finished_data_send-${this.method}`)
      return
    }

    // This can be synchronous for the serverless collector.
    this.collector.send(this.method, payload, (_, response) => {
      if (response && response.retainData) {
        this._merge(data)
      }

      // TODO: Log?
      this._afterSend(true)
      this.emit(`finished_data_send-${this.method}`)
    })
  }

  /**
   * Serialize all collected data and ship it off to the New Relic data
   * collector. The target endpoint is defined by {@link Aggregator#method}.
   *
   * @fires Aggregator#finished_data_send-analytic_event_data
   * @fires Aggregator#starting_data_send-analytic_event_data
   * @fires Aggregator#finished_data_send-custom_event_data
   * @fires Aggregator#starting_data_send-custom_event_data
   * @fires Aggregator#finished_data_send-error_data
   * @fires Aggregator#starting_data_send-error_data
   * @fires Aggregator#finished_data_send-error_event_data
   * @fires Aggregator#starting_data_send-error_event_data
   * @fires Aggregator#finished_data_send-log_event_data
   * @fires Aggregator#starting_data_send-log_event_data
   * @fires Aggregator#finished_data_send-metric_data
   * @fires Aggregator#starting_data_send-metric_data
   * @fires Aggregator#finished_data_send-span_event_data
   * @fires Aggregator#starting_data_send-span_event_data
   * @fires Aggregator#finished_data_send-sql_trace_data
   * @fires Aggregator#starting_data_send-sql_trace_data
   * @fires Aggregator#finished_data_send-transaction_sample_data
   * @fires Aggregator#starting_data_send-transaction_sample_data
   */
  send() {
    logger.debug(`${this.method} Aggregator data send.`)
    this.emit(`starting_data_send-${this.method}`)

    const data = this._getMergeData()
    if (this.isAsync) {
      this._toPayload((_, payload) => {
        this._runSend(data, payload)
      })
    } else {
      this._runSend(data, this._toPayloadSync())
    }

    this.clear()
  }

  reconfigure(config) {
    this.runId = config.run_id
    this.enabled = this.isEnabled(config)
  }
}

module.exports = Aggregator
