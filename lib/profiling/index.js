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
    this.tracer = agent.tracer
    this.samplingInterval = samplingInterval
    this.profilers = new Map()
    this.startTime = null
  }

  /**
   * Registers the enabled profilers. Async because the CPU profiler's `pprof`
   * SourceMapper is built (async) and injected at construction. Idempotent.
   *
   * @returns {Promise<void>}
   */
  async register() {
    if (this.config.include.includes('heap') && !this.profilers.has('HeapProfiler')) {
      const { HeapProfiler } = require('./profilers')
      // @todo pass in sourceMapper if enabled
      this.profilers.set('HeapProfiler', new HeapProfiler({ logger: this.logger }))
    }

    if (this.config.include.includes('cpu') && !this.profilers.has('CpuProfiler')) {
      const { CpuProfiler } = require('./profilers')
      const sourceMapper = this.config.source_mapping.enabled ? await this.#buildSourceMapper() : null
      this.profilers.set('CpuProfiler', new CpuProfiler({
        logger: this.logger,
        samplingInterval: this.samplingInterval,
        tracer: this.tracer,
        // null sourceMapper is a safe no-op
        sourceMapper
      }))
    }
  }

  /**
   * Builds the `pprof` SourceMapper by scanning the app root (`process.cwd()`) for
   * `.map` files. Logs the build cost; returns `null` on failure so frames fall
   * back to compiled file/line.
   *
   * @returns {Promise<object|null>} the SourceMapper, or `null` on failure
   */
  async #buildSourceMapper() {
    // lazy-require so pprof's native binding only loads when source mapping is enabled
    const { SourceMapper } = require('@datadog/pprof')
    const searchDir = process.cwd()
    try {
      const start = Date.now()
      const sourceMapper = await SourceMapper.create([searchDir])
      this.logger.debug(`Built profiling SourceMapper from ${searchDir} in ${Date.now() - start} ms.`)
      return sourceMapper
    } catch (error) {
      this.logger.error({ error }, `Failed to build profiling SourceMapper from ${searchDir}, frames will report compiled file/line.`)
      return null
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
