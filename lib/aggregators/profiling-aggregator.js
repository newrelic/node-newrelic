/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger').child({ component: 'pprof_aggregator' })
const BaseAggregator = require('./base-aggregator')
const ProfilingManager = require('#agentlib/profiling/index.js')

/**
 * Serves as a means for transmitting pprof data as it is being collected.
 * This doesn't really work as an "aggregator".  It instead leverages the `BaseAggregator`
 * to integrate with the `Harvester` and `Collector`
 *
 * The `ProfilingAggregator` aggregator overrides the base `start` method.
 * It sets up the interval based on configuration but instead of calling `send`,
 * it calls `collectData` which instructs the Profiler to collect profiling data
 * for every registered profiler(cpu, heap at the moment if enabled)
 *
 * @private
 * @class
 */
class ProfilingAggregator extends BaseAggregator {
  constructor(opts = {}, agent) {
    const { collector, harvester } = agent
    opts.method = opts.method || 'pprof_data'
    super(opts, collector, harvester)
    this.agent = agent
    this.profilingManager = new ProfilingManager(agent)
    this.pprofData = null
  }

  // simply returns what was given from the profiler collect method
  _toPayloadSync() {
    return this.pprofData
  }

  /**
   * This overrides the default `start` method
   * as we want to collect profiling data for `cpu` and/or `heap`
   * and send the gzipped binary encoded data for each profiler
   */
  start() {
    logger.trace(`${this.method} aggregator started.`)
    this.profilingManager.register()

    if (!this.sendTimer) {
      this.sendTimer = setInterval(this.collectData.bind(this), this.periodMs)
      this.sendTimer.unref()
    }
  }

  stop() {
    super.stop()
    this.profilingManager.stop()
  }

  /**
   * Called on an interval. Iterates over all registered profilers
   * and collects data for the given time period. Then asynchronously
   * calls send which takes care of sending the data to the collector
   */
  collectData() {
    const self = this
    for (const pprofData of this.profilingManager.collect()) {
      if (pprofData) {
        self.pprofData = pprofData
        self.send()
      }
    }
  }

  // `pprof_data` is not retained/merged in any way to just return null
  _getMergeData() {
    return null
  }

  // this implies the transmission fails
  // we log this error in `lib/collector/api.js#_handleResponseCode`
  _merge() {
    return null
  }

  // clears the `this.pprofData` for the next iteration of profiling collection
  clear() {
    this.pprofData = null
  }
}

module.exports = ProfilingAggregator
