/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const Subscriber = require('../base')
const { amqpConnection } = require('#agentlib/symbols.js')
const isString = require('#agentlib/util/is-string.js')

/**
 * This subscriber is two-fold:
 *  1. Capture the connection arguments and assign to symbol on connection to be
 *  used for all other amqplib subscribers.
 *  2. Create a segment for the connect. Note this will attempt to create a segment
 *  but the base subscriber will decide if it is created or not, otherwise it'll
 *  return the current context.
 */
class ConnectSubscriber extends Subscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'amqplib', channelName: 'nr_connect' })
    this.events = ['asyncStart', 'asyncEnd']
    this.requireActiveTx = false
    this.callback = -1
  }

  handler(data, ctx) {
    this.parameters = this.parseConnectionArgs(data.arguments)
    return this.createSegment({
      name: 'amqplib.connect',
      ctx
    })
  }

  asyncStart(data) {
    if (this.parameters && data.result) {
      data.result[amqpConnection] = this.parameters
    }
    super.asyncStart(data)
  }

  /**
   * Parses the connection args to return host/port
   *
   * @param {Array} args arguments passed to connect
   * @returns {object} { host, port }
   */
  parseConnectionArgs(args = []) {
    const [connArgs] = args
    const params = {}
    if (isString(connArgs)) {
      try {
        const parsedUrl = new URL(connArgs)
        params.host = parsedUrl.hostname
        if (parsedUrl.port) {
          params.port = parseInt(parsedUrl.port, 10)
        }
      } catch (err) {
        this.logger.error('Failed to parse connection string: %s', err.message)
      }
    } else {
      params.port = connArgs.port || (connArgs.protocol === 'amqp' ? 5672 : 5671)
      params.host = connArgs.hostname
    }

    return params
  }

  addAttributes(segment) {
    for (let [key, value] of Object.entries(this.parameters)) {
      // eslint-disable-next-line sonarjs/updated-loop-counter
      key = key === 'port' ? 'port_path_or_id' : key
      segment.addAttribute(key, value)
    }
  }
}

module.exports = ConnectSubscriber
