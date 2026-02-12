/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const BaseProfiler = require('./base')

class CpuProfiler extends BaseProfiler {
  #pprof
  constructor({ logger }) {
    super({ logger })
    this.name = 'CpuProfiler'
    this.#pprof = require('@datadog/pprof')
  }

  start() {
    if (this.#pprof.time.isStarted()) {
      this.logger.trace('CpuProfiler is already started, not calling start again.')
      return
    }

    this.#pprof.time.start({
      durationMillis: 60 * 1e3, // 1 min
      intervalMicros: (1e3 / 99) * 1000
    })
  }

  stop() {
    this.#pprof.time.stop(false)
  }

  async collect() {
    const profile = this.#pprof.time.stop(true)
    return this.#pprof.encode(profile)
  }
}

module.exports = CpuProfiler
