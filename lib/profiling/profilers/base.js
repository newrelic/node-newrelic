/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

class BaseProfiler {
  constructor({ logger }) {
    this.logger = logger
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
