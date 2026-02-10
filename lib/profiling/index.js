/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const defaultLogger = require('#agentlib/logger.js').child({ component: 'profiling-manager' })

class ProfilingManager {
  constructor(agent, { logger = defaultLogger } = {}) {
    this.logger = logger
    this.config = agent.config
    this.profilers = []
  }

  // current no-op until we built out the profilers
  register() {
  }

  start() {
    if (this.profilers.length === 0) {
      this.logger.warn('No profilers have been included in `config.profiling.include`, not starting any profilers.')
      return
    }

    for (const profiler of this.profilers) {
      this.logger.debug(`Starting ${profiler.name}`)
      profiler.start()
    }
  }

  stop() {
    if (this.profilers.length === 0) {
      this.logger.warn('No profilers have been included in `config.profiling.include`, not stopping any profilers.')
      return
    }

    for (const profiler of this.profilers) {
      this.logger.debug(`Stopping ${profiler.name}`)
      profiler.stop()
    }
  }

  collect() {
    const results = []
    if (this.profilers.length === 0) {
      this.logger.warn('No profilers have been included in `config.profiling.include`, not collecting any profiling data.')
      return results
    }

    return this.profilers.map((profiler) => {
      this.logger.debug(`Collecting profiling data for ${profiler.name}`)
      return profiler.collect()
    })
  }
}

module.exports = ProfilingManager
