/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = class Harvester {
  constructor() {
    this.aggregators = []
  }

  start() {
    this.aggregators.forEach((aggregator) => {
      if (aggregator.enabled) {
        aggregator.start()
      }
    })
  }

  clear(callback) {
    return Promise.all(
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

  stop() {
    this.aggregators.forEach((aggregator) => aggregator.stop())
  }

  update(config) {
    this.aggregators.forEach((aggregator) => {
      aggregator.reconfigure(config)
    })
  }

  add(aggregator) {
    this.aggregators.push(aggregator)
  }
}
