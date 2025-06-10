/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const DbOperationSubscriber = require('./db-operation')
const logger = require('../logger').child({ component: 'instrumentationSubscriber' })
const stringify = require('json-stringify-safe')

class IoRedisSubscriber extends DbOperationSubscriber {
  constructor(agent) {
    super(agent, 'ioredis:nr_sendCommand', 'Redis')
    this.events = ['asyncEnd']
  }

  handler(data, ctx) {
    const { self, arguments: args } = data
    const [command] = args
    this.operation = command.name
    this.setParameters(self, command)
    return super.handler(data, ctx)
  }

  setParameters(self, command) {
    this.parameters = {}
    this.parameters.product = this.system
    this.parameters.host = self?.connector?.options?.host
    this.parameters.port_path_or_id = self?.connector?.options?.port
    this.parameters.key = this.parseKey(command.args)
    this.parameters.database_name = self?.condition?.select
  }

  parseKey(keys) {
    let key
    if (keys && typeof keys !== 'function') {
      try {
        key = stringify(keys[0])
      } catch (err) {
        logger.debug(err, 'Failed to stringify ioredis key')
        key = '<unknown>'
      }
    }

    return key
  }
}

const ioRedisConfig = {
  package: 'ioredis',
  instrumentations: [
    {
      channelName: 'nr_sendCommand',
      module: { name: 'ioredis', versionRange: '>=4', filePath: 'built/Redis.js' },
      functionQuery: {
        className: 'Redis',
        methodName: 'sendCommand',
        kind: 'Async'
      }
    },
    {
      channelName: 'nr_sendCommand',
      module: { name: 'ioredis', versionRange: '>=4', filePath: 'built/redis.js' },
      functionQuery: {
        expressionName: 'sendCommand',
        kind: 'Async'
      }
    },
    {
      channelName: 'nr_sendCommand',
      module: { name: 'ioredis', versionRange: '>=4', filePath: 'built/redis/index.js' },
      functionQuery: {
        expressionName: 'sendCommand',
        kind: 'Async'
      }
    }
  ]
}

module.exports = {
  ioRedisConfig,
  IoRedisSubscriber
}
