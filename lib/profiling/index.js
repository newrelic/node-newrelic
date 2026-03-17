/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const defaultLogger = require('#agentlib/logger.js').child({ component: 'profiling-manager' })
const { createProfilingDurationMetric } = require('./metrics')

class ProfilingManager {
  constructor({ agent, samplingInterval }, { logger = defaultLogger } = {}) {
    this.logger = logger
    this.metrics = agent.metrics
    this.config = agent.config.profiling
    this.samplingInterval = samplingInterval
    this.profilers = new Map()
    this.startTime = null
  }

  register() {
    if (this.config.include.includes('heap') && !this.profilers.has('HeapProfiler')) {
      const { HeapProfiler } = require('./profilers')
      this.profilers.set('HeapProfiler', new HeapProfiler({ logger: this.logger }))
    }

    if (this.config.include.includes('cpu') && !this.profilers.has('CpuProfiler')) {
      const { CpuProfiler } = require('./profilers')
      this.profilers.set('CpuProfiler', new CpuProfiler({ logger: this.logger, samplingInterval: this.samplingInterval }))
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
    this.startTime = Date.now()
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
    this.calculateDuration()
  }

  calculateDuration() {
    if (!this.startTime) {
      this.logger.debug('Profiler was never started, not calculating duration')
      return
    }

    const start = this.startTime
    const duration = Date.now() - start
    createProfilingDurationMetric(this.metrics, duration)
    this.startTime = null
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
