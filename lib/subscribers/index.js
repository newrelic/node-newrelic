/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const createSubscriptionConfig = require('./create-config')
const { IoRedisSubscriber, ioRedisConfig } = require('./ioredis')
const { ElasticSearchSubscriber, elasticSearchConfig, ElasticSearchTransportSubscriber, elasticSearchTransportConfig } = require('./elasticsearch')
const { OpenSearchSubscriber, openSearchConfig } = require('./opensearch')
const { PinoSubscriber, pinoConfig } = require('./pino')

const subscriberConfigs = [
  elasticSearchConfig,
  elasticSearchTransportConfig,
  ioRedisConfig,
  openSearchConfig,
  pinoConfig
]

const config = createSubscriptionConfig(subscriberConfigs)

const subscribers = {
  ElasticSearchSubscriber,
  ElasticSearchTransportSubscriber,
  IoRedisSubscriber,
  OpenSearchSubscriber,
  PinoSubscriber
}

module.exports = {
  subscribers,
  config
}
