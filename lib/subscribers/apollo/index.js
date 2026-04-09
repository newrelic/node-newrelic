/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const BaseSubscriber = require('../base')
const genericRecorder = require('#agentlib/metrics/recorders/generic.js')

module.exports = class ApolloSubscriber extends BaseSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: '@apollo/server', channelName: 'nr_processRequest' })
  }

  /**
   * We have to wrap the Promise prototype, not just the _then method.
   * This is because we need to get the current context from when the promise was constructed.
   * If we only wrapped `_then`, the context is not the same, you can see from the versioned tests
   * Where it will defer promise resolution
   *
   * @param {object} data event data
   * @param {Context} ctx the current context
   * @returns {Context} in this case it is the same context, just with both `_then` and its respective callbacks bound to the current context
   */
  handler(data, ctx) {
    const [, server] = data.arguments
    if (!Array.isArray(server?.internals.plugins) || !this.hasNrPlugin(server.internals.plugins)) {
      this.logger.debug('No registered New Relic Apollo Server Plugin, not creating segment')
      return ctx
    }

    return this.createSegment({
      name: 'GraphQL/operation/ApolloServer/<unknown>',
      recorder: genericRecorder,
      ctx
    })
  }

  /**
   * Since the instrumentation for apollo server is plugin driven,
   * we must check if the server instance has the NR plugin registered
   *
   * @param {Array} plugins registered apollo server plugins
   * @returns {boolean} if one of the plugins is NR apollo server plugin
   */
  hasNrPlugin(plugins) {
    return plugins.some((plugin) => plugin.__nrPlugin === true)
  }
}
