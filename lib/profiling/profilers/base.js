/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

class BaseProfiler {
  /**
   * pprof `SourceMapper` to be shared across the entire agent
   * instance, or `null`/`undefined` if disabled.
   * When set, pprof resolves sample frames to their original
   * source at serialization (e.g. TypeScript, minified code).
   */
  sourceMapper

  constructor({ logger, sourceMapper }) {
    this.logger = logger
    this.sourceMapper = sourceMapper
  }

  start() {
    throw new Error('start is not implemented')
  }

  stop() {
    throw new Error('stop is not implemented')
  }

  async collect() {
    throw new Error('collect is not implemented')
  }
}

module.exports = BaseProfiler
