/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const BaseProfiler = require('../profilers/base')

class HeapProfiler extends BaseProfiler {
  #pprof
  constructor() {
    super()
    this.name = 'HeapProfiler'
    this.#pprof = require('@datadog/pprof')
  }

  start() {
    const intervalBytes = 524288
    const stackDepth = 64

    this.#pprof.heap.start(intervalBytes, stackDepth)
  }

  stop() {
    this.#pprof.heap.stop()
  }

  collect() {
    const profile = this.#pprof.heap.profile()
    return this.#pprof.encodeSync(profile)
  }
}

module.exports = HeapProfiler
