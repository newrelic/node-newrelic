/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const BaseProfiler = require('./base')

class CpuProfiler extends BaseProfiler {
  #pprof
  #durationMillis
  #intervalMicros = (1e3 / 99) * 1000 // samples at 99hz(99 times per second)
  constructor({ logger, samplingInterval }) {
    super({ logger })
    this.#pprof = require('@datadog/pprof')
    this.#durationMillis = samplingInterval
  }

  start() {
    if (this.#pprof.time.isStarted()) {
      this.logger.trace('CpuProfiler is already started, not calling start again.')
      return
    }

    this.logger.trace(`Starting CpuProfiler, sample every ${this.#intervalMicros}hz for ${this.#durationMillis} ms.`)
    this.#pprof.time.start({
      durationMillis: this.#durationMillis,
      intervalMicros: this.#intervalMicros
    })
  }

  stop() {
    if (!this.#pprof.time.isStarted()) {
      this.logger.trace('CpuProfiler is not started, not stopping.')
      return
    }

    this.#pprof.time.stop(false)
  }

  async collect() {
    const profile = this.#pprof.time.stop(true)
    return this.#pprof.encode(profile)
  }
}

module.exports = CpuProfiler
