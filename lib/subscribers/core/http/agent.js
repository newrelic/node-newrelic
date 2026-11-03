/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const BaseCoreSubscriber = require('../base')
const { wrapMethod } = require('../../wrap-method')

const instrumentedMethods = ['createConnection']
const SEGMENT_NAME = 'http.Agent#createConnection'

/**
 * Records the connections an `http` agent opens for outbound requests. It
 * wraps `Agent#createConnection`, which publishes each connection to the
 * `nr:agent:http:createConnection` tracing channel, so the socket's own
 * segments, e.g. `net.createConnection` and `dns.lookup`, are created under the
 * connection segment. The `agent` prefix keeps its id distinct from the other
 * `http` subscribers. `HttpsAgentSubscriber` reuses it for `https`.
 */
class HttpAgentSubscriber extends BaseCoreSubscriber {
  constructor({ agent, logger, packageName = 'http' }) {
    super({ agent, logger, packageName, prefix: 'agent', instrumentedMethods })
  }

  /**
   * Creates the `http.Agent#createConnection` segment for a connection opened
   * by a request. Under an opaque parent no segment is created, and the parent
   * is the one `end` touches.
   *
   * @param {object} data Event data published to the `start` event.
   * @param {object} ctx The current async context.
   * @returns {object} The updated context with the connection segment, or the
   * original context when the parent segment is opaque.
   */
  handler(data, ctx) {
    if (ctx.segment?.opaque) {
      data.segment = ctx.segment
      return ctx
    }

    const newCtx = this.createSegment({ name: SEGMENT_NAME, ctx })
    data.segment = newCtx.segment
    return newCtx
  }

  /**
   * Touches the segment `handler` chose once the synchronous
   * `createConnection` call returns.
   *
   * @param {object} data Event data published to the `end` event.
   * @param {TraceSegment} [data.segment] The connection segment, or the opaque
   * parent.
   */
  end(data) {
    data.segment?.touch()
  }

  /**
   * Wraps the module's `Agent#createConnection` to publish each connection
   * made in a transaction to the `createConnection` tracing channel. Nothing is
   * wrapped in Azure Functions, where the `@azure/functions` instrumentation
   * records requests instead.
   *
   * @param {object} mod The `http` or `https` module.
   */
  instrument(mod) {
    if (process.env.FUNCTIONS_WORKER_RUNTIME) {
      this.logger.debug('In azure functions environment, disabling core %s agent instrumentation in favor of @azure/functions', this.packageName)
      return
    }

    this.#wrapCreateConnection(mod)
  }

  /**
   * Wraps the module's `Agent#createConnection`.
   *
   * @param {object} mod The `http` or `https` module.
   */
  #wrapCreateConnection(mod) {
    const { agent } = this
    // the base class builds one channel per entry in `instrumentedMethods`
    const [channel] = this.channels
    const agentProto = mod.Agent?.prototype
    if (!agentProto) {
      this.logger.trace('No Agent on the module, not wrapping createConnection')
      return
    }

    wrapMethod({
      module: agentProto,
      methodName: 'createConnection',
      logger: this.logger,
      wrapper: function wrapCreateConnection(original) {
        return function wrappedCreateConnection(...args) {
          if (!agent.getTransaction()) {
            return original.apply(this, args)
          }

          return channel.traceSync(original, {}, this, ...args)
        }
      }
    })
  }
}

module.exports = HttpAgentSubscriber
