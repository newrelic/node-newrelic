/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const defaultLogger = require('#agentlib/logger.js').child({ component: 'profiling-manager' })

class ProfilingManager {
  constructor(agent, { logger = defaultLogger } = {}) {
    this.logger = logger
    this.config = agent.config.profiling
    this.profilers = new Map()
  }

  register() {
    if (this.config.include.includes('heap') && !this.profilers.has('HeapProfiler')) {
      const { HeapProfiler } = require('./profilers')
      this.profilers.set('HeapProfiler', new HeapProfiler({ logger: this.logger }))
    }

    if (this.config.include.includes('cpu') && !this.profilers.has('CpuProfiler')) {
      const { CpuProfiler } = require('./profilers')
      this.profilers.set('CpuProfiler', new CpuProfiler({ logger: this.logger }))
    }
  }

  start() {
    if (this.profilers.size === 0) {
      this.logger.warn('No profilers have been included in `config.profiling.include`, not starting any profilers.')
      return false
    }

    for (const [name, profiler] of this.profilers) {
      this.logger.debug(`Starting ${name}`)
      profiler.start()
    }
    return true
  }

  stop() {
    if (this.profilers.size === 0) {
      this.logger.warn('No profilers have been included in `config.profiling.include`, not stopping any profilers.')
      return
    }

    for (const [name, profiler] of this.profilers) {
      this.logger.debug(`Stopping ${name}`)
      profiler.stop()
    }
  }

  async collect() {
    const results = []
    if (this.profilers.size === 0) {
      this.logger.warn('No profilers have been included in `config.profiling.include`, not collecting any profiling data.')
      return results
    }

    for (const [name, profiler] of this.profilers) {
      this.logger.debug(`Collecting profiling data for ${name}`)
      const pprofData = await profiler.collect()
      results.push(pprofData)
    }

    return results
  }
}

module.exports = ProfilingManager
