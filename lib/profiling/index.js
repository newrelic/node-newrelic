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
    this.profilers = []
    this.outputDir = process.cwd() + '/profiler-data'
  }

  register() {
    if (this.config.include.includes('heap')) {
      const { HeapProfiler } = require('./profilers')
      this.profilers.push(new HeapProfiler({ logger: this.logger }))
    }

    if (this.config.include.includes('cpu')) {
      const { CpuProfiler } = require('./profilers')
      this.profilers.push(new CpuProfiler({ logger: this.logger }))
    }
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
    if (this.profilers.length === 0) {
      this.logger.warn('No profilers have been included in `config.profiling.include`, not collecting any profiling data.')
      return results
    }

    for (const profiler of this.profilers) {
      this.logger.debug(`Collecting profiling data for ${profiler.name}`)
      const pprofData = await profiler.collect()
      this.writeFile({ pprofData, name: profiler.name })
      results.push(pprofData)
    }

    return results
  }
}

module.exports = ProfilingManager
