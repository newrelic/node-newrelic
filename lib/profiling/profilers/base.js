/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

class BaseProfiler {
  set name(name) {
    this._name = name
  }

  get name() {
    return this._name
  }

  start() {
    throw new Error('start is not implemented')
  }

  stop() {
    throw new Error('stop is not implemented')
  }

  collect() {
    throw new Error('collect is not implemented')
  }
}

module.exports = BaseProfiler
