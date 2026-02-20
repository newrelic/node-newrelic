/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const DbOperationSubscriber = require('../db-operation')
const { redisClientOpts } = require('../../symbols')

/**
 * Listens to events on `RedisCommandQueue.addCommand` to create
 * the segment with necessary datastore parameters for a given Redis
 * operation.
 *
 * Relies on `ctx[redisClientOpts]` being set for the `host`, `port_path_or_id`,
 * and `database` parameters.
 */
module.exports = class CmdQueueAddCmdSubscriber extends DbOperationSubscriber {
  constructor({ agent, logger, channelName = 'nr_addCommand' }) {
    super({ agent, logger, packageName: '@node-redis/client', channelName, system: 'Redis' })
    this.events = ['asyncEnd']
  }

  handler(data, ctx) {
    const { arguments: args } = data
    const [cmd, key, value] = args[0]
    this.setParameters({ ctx, key, value })
    this.operation = cmd?.toLowerCase() || 'other'
    return super.handler(data, ctx)
  }

  setParameters({ ctx, key, value }) {
    const clientParams = ctx[redisClientOpts] ?? {}
    this.parameters = Object.assign({}, clientParams)
    this.parameters.product = this.system

    if (this.agent.config.attributes.enabled) {
      if (key) {
        this.parameters.key = JSON.stringify(key)
      }
      if (value) {
        this.parameters.value = JSON.stringify(value)
      }
    }
  }
}
