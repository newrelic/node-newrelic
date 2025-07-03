/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const createSubscriptionConfig = require('./create-config')
const { IoRedisSubscriber, ioRedisConfig } = require('./ioredis')
const subscriberConfigs = [
  ioRedisConfig
]

const config = createSubscriptionConfig(subscriberConfigs)

const subscribers = {
  IoRedisSubscriber
}

module.exports = {
  subscribers,
  config
}
