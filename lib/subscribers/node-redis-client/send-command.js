/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const BaseSendCommandSubscriber = require('../redis-client/send-command')

module.exports = class ClientSendCommandSubscriber extends BaseSendCommandSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: '@node-redis/client' })
  }
}
