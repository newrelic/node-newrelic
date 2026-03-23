/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Subscriber = require('../base.js')
const shouldTrackError = require('./should-track-error.js')
const recordExternal = require('#agentlib/metrics/recorders/http_external.js')

module.exports = class GrpcClientSubscriber extends Subscriber {
  constructor({ agent, logger, channelName }) {
    super({
      agent,
      logger,
      channelName,
      packageName: '@grpc/grpc-js',
    })

    this.opaque = true
  }

  handler(data, ctx) {
    const { arguments: args, self: client } = data
    const { transaction } = ctx

    const { channel } = client
    const authorityName = channel.target?.path || channel.getDefaultAuthority
    // In grpc-js>=1.8.0  `.methodName` becomes `.method`.
    const method = client.methodName || client.method

    const newCtx = this.createSegment({
      name: `External/${authorityName}${method}`,
      recorder: recordExternal(authorityName, 'gRPC'),
      ctx
    })
    const { segment } = newCtx

    const origMetadata = args[0]
    const origListener = args[1]
    const nrMetadata = origMetadata.clone()
    const nrListener = Object.assign({}, origListener)
    args[0] = nrMetadata
    args[1] = nrListener

    const outboundAgentHeaders = Object.create(null)
    if (this.agent.config.distributed_tracing.enabled === true) {
      transaction.insertDistributedTraceHeaders(outboundAgentHeaders)
      for (const [key, value] of Object.entries(outboundAgentHeaders)) {
        nrMetadata.add(key, value)
      }
    } else {
      this.logger.debug('Distributed tracing disabled by instrumentation.')
    }

    nrListener.onReceiveStatus = (status) => {
      const { code, details } = status
      segment.addAttribute('grpc.statusCode', code)
      segment.addAttribute('grpc.statusText', details)
      segment.addAttribute('component', 'gRPC')

      if (shouldTrackError(code, this.agent.config) === true) {
        this.agent.errors.add(transaction, details)
      }

      const protocol = 'grpc:'
      const [hostname, port] = authorityName.split(':')
      segment.captureExternalAttributes({
        protocol,
        host: authorityName,
        port,
        hostname,
        method,
        path: method
      })

      if (typeof origListener?.onReceiveStatus === 'function') {
        const boundFn = this.agent.tracer.bindFunction(
          origListener.onReceiveStatus,
          newCtx,
          true
        )
        boundFn(status)
      }
    }

    return newCtx
  }
}
