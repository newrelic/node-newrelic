/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const BaseMultiSubscriber = require('../redis-client/multi')

module.exports = class ClientMultiSubscriber extends BaseMultiSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: '@node-redis/client' })
  }
}
