/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const BaseCmdQueueAddCmdSubsriber = require('../redis-client/add-command')

module.exports = class CmdQueueAddCmdSubscriber extends BaseCmdQueueAddCmdSubsriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: '@node-redis/client' })
  }
}
