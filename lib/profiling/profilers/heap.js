/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const BaseProfiler = require('../profilers/base')

class HeapProfiler extends BaseProfiler {
  #pprof
  #intervalBytes = 524288
  #stackDepth = 64
  constructor({ logger }) {
    super({ logger })
    this.#pprof = require('@datadog/pprof')
  }

  start() {
    try {
      this.#pprof.heap.start(this.#intervalBytes, this.#stackDepth)
    } catch (error) {
      this.logger.error({ error }, 'Failed to start HeapProfiler')
    }
  }

  stop() {
    this.#pprof.heap.stop()
  }

  async collect() {
    const profile = this.#pprof.heap.profile()
    return this.#pprof.encode(profile)
  }
}

module.exports = HeapProfiler
