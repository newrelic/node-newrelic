/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const createSubscriptionConfig = require('./create-config')
const { IoRedisSubscriber, ioRedisConfig } = require('./ioredis')
const { ElasticSearchSubscriber, elasticSearchConfig, ElasticSearchTransportSubscriber, elasticSearchTransportConfig } = require('./elasticsearch')

const subscriberConfigs = [
  elasticSearchConfig,
  elasticSearchTransportConfig,
  ioRedisConfig
]

const config = createSubscriptionConfig(subscriberConfigs)

const subscribers = {
  ElasticSearchSubscriber,
  ElasticSearchTransportSubscriber,
  IoRedisSubscriber
}

module.exports = {
  subscribers,
  config
}
