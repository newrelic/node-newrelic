/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Subscriber = require('../base.js')
const { undiciConnection } = require('#agentlib/symbols.js')

/**
 * undici builds its socket connector via `buildConnector`, and hands the socket
 * that connector produces to `http2.connect` (via `createConnection`) when it
 * negotiates HTTP/2. The undici subscriber already records an external segment
 * for the request, so the core http2 instrumentation must not create a second
 * one. We stamp every socket undici's connector returns a symbol;
 * the http2 instrumentation checks for it and skips.
 *
 * `buildConnector` is a factory: it returns the connector function that, when
 * called, synchronously returns the socket. We wrap that returned connector so
 * the socket is stamped before undici passes it to `http2.connect`.
 *
 * @see https://github.com/newrelic/node-newrelic/issues/4250
 */
class BuildConnectorSubscriber extends Subscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'undici', channelName: 'nr_buildConnector' })
    this.requireActiveTx = false
    this.events = ['end']
  }

  /**
   * Picks up the connector function returned by `buildConnector` and replaces
   * it with a wrapper that stamps the socket it produces.
   *
   * @param {object} data event data from Orchestrion; `data.result` is the
   * connector function returned by `buildConnector`.
   */
  end(data) {
    const connector = data.result
    if (typeof connector !== 'function') {
      return
    }

    data.result = function nrWrappedConnector(...args) {
      const socket = connector.apply(this, args)
      if (socket) {
        socket[undiciConnection] = true
      }
      return socket
    }
  }
}

module.exports = BuildConnectorSubscriber
