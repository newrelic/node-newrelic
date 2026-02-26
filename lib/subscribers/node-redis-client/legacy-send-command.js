/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const BaseLegacySendCmdSubscriber = require('../redis-client/legacy-send-command')

module.exports = class LegacySendCmdSubscriber extends BaseLegacySendCmdSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: '@node-redis/client' })
  }
}
