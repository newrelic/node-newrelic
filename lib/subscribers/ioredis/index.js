/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const DbOperationSubscriber = require('../db-operation')
const stringify = require('json-stringify-safe')

class IoRedisSubscriber extends DbOperationSubscriber {
  constructor({ agent, logger, packageName = 'ioredis', system = 'Redis' }) {
    super({ agent, logger, packageName, channelName: 'nr_sendCommand', system })
    this.events = ['asyncEnd', 'end']
  }

  handler(data, ctx) {
    const { self, arguments: args } = data
    const [command] = args
    this.operation = command.name
    this.setParameters(self, command)
    return super.handler(data, ctx)
  }

  /**
   * Same code as `lib/subscribers/openai/base.js` but being used for a different reason.
   * For the standard `await redis.<cmd>(..args)`, tracePromise works just fine. It's to appease the `redis.pipeline().<cmd>(...args).exec()` case.
   * When commands are queued, a `.then` and `.catch` handler is attached, but don't queue up the result of that, but instead just queue up the command. They've broken the promise chain and since `tracePromise` just continues the chain, this will cause an unhandledRejection.
   * see: https://github.com/redis/ioredis/blob/d5f5b407bd1287fd86d2ca5df7a10c50c9702305/lib/Pipeline.ts#L218
   *
   * @param {object} data the data associated with the `end` event
   */
  end(data) {
    const promise = data?.result
    if (typeof promise.then !== 'function') {
      return promise
    }

    promise.then((result) => {
      data.result = result
      this.channel.asyncEnd.publish(data)
    }, (err) => {
      data.error = err
      this.channel.asyncEnd.publish(data)
    })
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
        this.logger.debug(err, 'Failed to stringify ioredis key')
        key = '<unknown>'
      }
    }

    return key
  }
}

module.exports = IoRedisSubscriber
