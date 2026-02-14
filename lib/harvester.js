/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict'
const defaultLogger = require('./logger').child({ component: 'harvester' })

/**
 * @class
 * @classdesc Used to keep track of all registered aggregators.
 */
module.exports = class Harvester {
  constructor({ logger = defaultLogger } = {}) {
    this.aggregators = []
    this.logger = logger
  }

  /**
   * Calls start on every registered aggregator that is enabled.
   */
  start() {
    for (const aggregator of this.aggregators) {
      if (aggregator.enabled && aggregator.delay > 0) {
        this.logger.debug(`Delay start of ${aggregator.method} by ${aggregator.delay} milliseconds`)
        const timeout = setTimeout(() => {
          aggregator.start()
        }, aggregator.delay)
        timeout.unref()
      } else if (aggregator.enabled) {
        aggregator.start()
      }

      if (aggregator.enabled && aggregator.duration > 0) {
        this.logger.debug(`Running ${aggregator.method} for ${aggregator.duration} milliseconds`)
        const durationTimeout = setTimeout(() => {
          aggregator.stop()
        }, aggregator.delay + aggregator.duration)
        durationTimeout.unref()
      }
    }
  }

  /**
   * Calls send on every registered aggregator that is enabled.
   * It then will wait for the collector to acknowledge that the data has been
   * sent and resolve a promise.
   *
   * @param {Function} callback function to call once all aggregators have sent data
   */
  clear(callback) {
    Promise.all(
      this.aggregators.map((aggregator) => new Promise((resolve) => {
        if (aggregator.enabled) {
          aggregator.once(`finished_data_send-${aggregator.method}`, function finish() {
            resolve()
          })

          aggregator.send()
        } else {
          // No data to flush because aggregator is not enabled
          resolve()
        }
      }))
    ).then(() => {
      // Get out of the promise so callback errors aren't treated as
      // promise rejections.
      setImmediate(callback)
    })
  }

  /**
   * Calls stop on every registered aggregator.
   */
  stop() {
    for (const aggregator of this.aggregators) {
      aggregator.stop()
    }
  }

  /**
   * Calls reconfigure on every registered aggregator.
   *
   * @param {object} config updated agent configuration
   */
  update(config) {
    for (const aggregator of this.aggregators) {
      aggregator.reconfigure(config)
    }
  }

  /**
   * Registers an aggregator with the Harvester instance.
   *
   * @param {object} aggregator Aggregator instance
   */
  add(aggregator) {
    this.aggregators.push(aggregator)
  }
}
