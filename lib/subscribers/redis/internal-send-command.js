/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const DbOperationSubscriber = require('../db-operation')
const stringify = require('json-stringify-safe')

module.exports = class RedisInternalSendCommandSubscriber extends DbOperationSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'redis', channelName: 'nr_internalSendCommand', system: 'Redis' })
    this.events = ['end']
    this.propagateContext = true
    this.callback = 0
    this.callbackKey = 'callback'
  }

  handler(data, ctx) {
    const { arguments: args, self: client } = data
    const commandObject = args[0]
    const keys = commandObject.args
    this.parameters = this.#getInstanceParameters(client, keys)
    this.operation = commandObject.command || 'other'

    return super.handler(data, ctx)
  }

  /**
   * Captures the necessary datastore parameters from redis v3 client
   *
   * @param {object} client instance of redis v3 client
   * @param {string[]} keys list of keys
   * @returns {object} datastore parameters: host, port_path_or_id, database_name, product, key
   */
  #getInstanceParameters(client, keys) {
    const opts = client?.connection_options

    return {
      host: opts.host || 'localhost',
      port_path_or_id: opts.path || opts.port || '6379',
      database_name: client.selected_db || opts.db || 0,
      product: this.system,
      key: this.#stringifyKeys(keys)
    }
  }

  #stringifyKeys(keys) {
    let key = null
    if (keys && keys.length) {
      try {
        key = stringify(keys[0])
      } catch (err) {
        this.logger.debug(err, 'Failed to stringify redis key for send command')
        key = '<unknown>'
      }
    }

    return key
  }
}
