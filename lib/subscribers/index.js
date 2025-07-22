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
const { McpClientSubscriber, mcpClientConfig } = require('./mcp-client')

const subscriberConfigs = [
  elasticSearchConfig,
  elasticSearchTransportConfig,
  ioRedisConfig,
  openSearchConfig,
  pinoConfig,
  mcpClientConfig
]

const config = createSubscriptionConfig(subscriberConfigs)

const subscribers = {
  ElasticSearchSubscriber,
  ElasticSearchTransportSubscriber,
  IoRedisSubscriber,
  OpenSearchSubscriber,
  PinoSubscriber,
  McpClientSubscriber
}

module.exports = {
  subscribers,
  config
}
