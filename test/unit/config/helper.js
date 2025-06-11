/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Config = require('../../../lib/config')

class TestConfigLogger {
  #logs = {
    error: [],
    trace: [],
    warn: []
  }

  get logs() { return this.#logs }

  child() {
    return this
  }

  error(...args) {
    this.#logs.error.push(args)
  }

  trace(...args) {
    this.#logs.trace.push(args)
  }

  warn(...args) {
    this.#logs.warn.push(args)
  }
}

function idempotentEnv(envConfig, initialConfig, callback) {
  const saved = {}

  // Allow idempotentEnv to be called w/o initialConfig
  if (typeof initialConfig === 'function') {
    callback = initialConfig
    initialConfig = {}
  }

  Object.keys(envConfig).forEach((key) => {
    // process.env is not a normal object
    if (Object.hasOwnProperty.call(process.env, key)) {
      saved[key] = process.env[key]
    }

    process.env[key] = envConfig[key]
  })
  try {
    const loggerInstance = new TestConfigLogger()
    const tc = Config.initialize(initialConfig, { loggerInstance })
    callback(tc, loggerInstance)
  } finally {
    Object.keys(envConfig).forEach((finalKey) => {
      if (saved[finalKey]) {
        process.env[finalKey] = saved[finalKey]
      } else {
        delete process.env[finalKey]
      }
    })
  }
}

module.exports = {
  idempotentEnv
}
