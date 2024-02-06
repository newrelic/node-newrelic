/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * @class
 * @classdesc Used to keep track of all registered aggregators.
 */
module.exports = class Harvester {
  constructor() {
    this.aggregators = []
  }

  /**
   * Calls start on every registered aggregator that is enabled.
   */
  start() {
    this.aggregators.forEach((aggregator) => {
      if (aggregator.enabled) {
        aggregator.start()
      }
    })
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
      this.aggregators.map((aggregator) => {
        return new Promise((resolve) => {
          if (aggregator.enabled) {
            aggregator.once(`finished ${aggregator.method} data send.`, function finish() {
              resolve()
            })

            aggregator.send()
          } else {
            // No data to flush because aggregator is not enabled
            resolve()
          }
        })
      })
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
    this.aggregators.forEach((aggregator) => aggregator.stop())
  }

  /**
   * Calls reconfigure on every registered aggregator.
   *
   * @param {object} config updated agent configuration
   */
  update(config) {
    this.aggregators.forEach((aggregator) => {
      aggregator.reconfigure(config)
    })
  }

  /**
   * Registers an aggregator with the Harvester instance.
   *
   * @param aggregator
   */
  add(aggregator) {
    this.aggregators.push(aggregator)
  }
}
