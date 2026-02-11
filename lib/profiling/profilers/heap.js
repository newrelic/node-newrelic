/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const BaseProfiler = require('../profilers/base')

class HeapProfiler extends BaseProfiler {
  constructor() {
    super()
    this.name = 'heap'
    // tmp hard code these values for now
    this.heapSampleIntervalBytes = 524288
    this.heapSampleStackDepth = 64
    this.pprofData = null
  }

  get pprof() {
    if (!this._pprof) {
      this._pprof = require('@datadog/pprof')
    }
    return this._pprof
  }

  start() {
    this.pprof.heap.start(this.heapSampleIntervalBytes, this.heapSampleStackDepth)
  }

  stop() {
    this.pprof.heap.stop()
  }

  async collect() {
    const profile = await this.pprof.heap.profile()
    const buf = await this.pprof.encode(profile)
    this.pprofData = buf
  }
}

module.exports = HeapProfiler
