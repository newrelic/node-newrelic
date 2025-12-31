/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const IoRedisSubscriber = require('../ioredis')

class IovalkeySubscriber extends IoRedisSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'iovalkey', system: 'Valkey' })
  }
}

module.exports = IovalkeySubscriber
