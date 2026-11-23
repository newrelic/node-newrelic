/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const BatchSubscriber = require('./batch')

/**
 * `RedisClient._executePipeline` submits each queued command to the server
 * as one batch. Unlike `_executeMulti`, there are no synthetic `MULTI`/
 * `EXEC` entries, so the default command list from `BatchSubscriber` applies
 * as-is.
 */
module.exports = class ExecutePipelineSubscriber extends BatchSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_executePipeline' })
  }
}
