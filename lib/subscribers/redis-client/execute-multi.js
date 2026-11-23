/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const BatchSubscriber = require('./batch')

/**
 * `RedisClient._executeMulti` submits `MULTI`, each queued command, and
 * `EXEC` to the server as one batch. The `MULTI`/`EXEC` entries are added
 * internally and are not part of the `commands` argument, so add them here
 * to keep the `Datastore/operation/Redis/multi` and `.../exec` metrics that
 * existed before `@redis/client@6.4.0` introduced batching.
 */
module.exports = class ExecuteMultiSubscriber extends BatchSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_executeMulti' })
  }

  getCommands(commands) {
    return [['MULTI'], ...commands.map(({ args }) => args), ['EXEC']]
  }
}
