/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const HttpClientSubscriber = require('../http/client')

/**
 * `https.request` and `https.get` construct their own `http.ClientRequest`
 * instead of calling `http.request`, so `https` needs its own wrap. Its
 * requests are otherwise recorded exactly like `http` requests.
 */
module.exports = class HttpsClientSubscriber extends HttpClientSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'https' })
  }
}
