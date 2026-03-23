/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const GCS = require('./client.js')

module.exports = class Http2StreamSubscriber extends GCS {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_grpc_stream' })
  }
}
