/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const HttpAgentSubscriber = require('../http/agent')

/**
 * `https.Agent` defines its own `createConnection`, which opens a TLS socket,
 * instead of inheriting the `http.Agent` one, so `https` needs its own wrap.
 */
module.exports = class HttpsAgentSubscriber extends HttpAgentSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'https' })
  }
}
