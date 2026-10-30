/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const HttpSubscriber = require('../http/server')

/**
 * `https.Server` is not a subclass of `http.Server` (it is built on
 * `tls.Server` instead), so it needs its own `emit` wrap -- but requests are
 * still served with `http.ServerResponse`/`http.IncomingMessage` instances,
 * which `HttpSubscriber` already wraps once via the `http` package.
 */
module.exports = class HttpsSubscriber extends HttpSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'https' })
  }

  get transport() {
    return 'HTTPS'
  }
}
