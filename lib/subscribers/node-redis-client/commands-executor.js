/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const BaseCmdExecutorSubscriber = require('../redis-client/commands-executor')

module.exports = class ClientCommandsExecutorSubscriber extends BaseCmdExecutorSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: '@node-redis/client' })
  }
}
