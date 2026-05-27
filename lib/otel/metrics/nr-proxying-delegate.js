/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const defaultLogger = require('#agentlib/logger.js').child({
  component: 'nr-proxying-delegate'
})

/**
 * A wrapper over a standard OpenTelemetry "delegate" (thing that does the
 * actual work of sending and receiving data to/from a collector) so that we
 * can write an audit log when the export has completed.
 */
class NRProxyingDelegate {
  #logger
  #wrappedDelegate

  constructor(delegateToProxy, logger = defaultLogger) {
    this.#wrappedDelegate = delegateToProxy
    this.#logger = logger.child({ subcomponent: this.constructor.name })
  }

  export(items, resultCallback) {
    this.#wrappedDelegate.export(items, (result) => {
      this.#logger.audit('Received metrics export result code: %s', result.code)
      resultCallback(result)
    })
  }

  forceFlush() {
    return this.#wrappedDelegate.forceFlush()
  }

  shutdown() {
    return this.#wrappedDelegate.shutdown()
  }
}

module.exports = NRProxyingDelegate
