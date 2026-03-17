/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const BaseProfiler = require('../profilers/base')

class HeapProfiler extends BaseProfiler {
  #pprof
  #intervalBytes = 524288 // captures stack trace every 512 kb of allocated memory
  #stackDepth = 64
  constructor({ logger }) {
    super({ logger })
    this.#pprof = require('@datadog/pprof')
  }

  start() {
    try {
      this.logger.trace(`Starting HeapProfiler, sample every ${this.#intervalBytes} bytes with a stack depth of ${this.#stackDepth}`)
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
