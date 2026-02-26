/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const BaseSelectSubscriber = require('../redis-client/select')

module.exports = class ClientSelectSubscriber extends BaseSelectSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: '@node-redis/client' })
  }
}
