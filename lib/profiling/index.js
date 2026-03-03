/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const defaultLogger = require('#agentlib/logger.js').child({ component: 'profiling-manager' })
const { mkdir, writeFile } = require('node:fs/promises')
const { randomUUID } = require('node:crypto')

class ProfilingManager {
  constructor(agent, { logger = defaultLogger } = {}) {
    this.logger = logger
    this.config = agent.config.profiling
    this.profilers = new Map()
    this.outputDir = process.cwd() + '/profiler-data'

    if (this.config.enabled) {
      this.agent.metrics.getOrCreateMetric('Supportability/Nodejs/Profiling/enabled').incrementCallCount()
    } else {
      this.agent.metrics.getOrCreateMetric('Supportability/Nodejs/Profiling/disabled').incrementCallCount()
    }
  }

  register() {
    if (this.config.include.includes('heap') && !this.profilers.has('HeapProfiler')) {
      const { HeapProfiler } = require('./profilers')
      this.profilers.set('HeapProfiler', new HeapProfiler({ logger: this.logger }))
      this.agent.metrics.getOrCreateMetric('Supportability/Nodejs/Profiling/Heap').incrementCallCount()
    }

    if (this.config.include.includes('cpu') && !this.profilers.has('CpuProfiler')) {
      const { CpuProfiler } = require('./profilers')
      this.profilers.set('CpuProfiler', new CpuProfiler({ logger: this.logger }))
      this.agent.metrics.getOrCreateMetric('Supportability/Nodejs/Profiling/CPU').incrementCallCount()
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
    this.profilers.startedAt = Date.now()
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
    // reset start time for next time profiler is started
    const durationInMillis = Date.now() - this.profilers.startedAt
    this.profilers.startedAt = null
    this.agent.metrics.measureMilliseconds('Supportability/Nodejs/Profiling/Duration', null, durationInMillis)
  }

  async writeFile({ pprofData, name }) {
    if (this.config.debug) {
      const fileName = `${this.outputDir}/${name}-${randomUUID()}.gz`
      try {
        this.logger.trace(`Writing ${name} pprof data to ${fileName}`)
        await mkdir(this.outputDir, { recursive: true })
        writeFile(fileName, pprofData)
      } catch (err) {
        this.logger.error(`Failed to write pprof data to ${fileName}: ${err.message}`)
      }
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
      this.writeFile({ pprofData, name })
      results.push(pprofData)
    }

    return results
  }
}

module.exports = ProfilingManager
