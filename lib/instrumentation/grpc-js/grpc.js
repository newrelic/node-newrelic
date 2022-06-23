/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const recordExternal = require('../../metrics/recorders/http_external')

module.exports = function instrument(shim) {
  const callStream = shim.require('./build/src/call-stream')
  shim.wrap(callStream.Http2CallStream.prototype, 'start', (shim, original) => {
    return function wrappedStart() {
      const activeSegment = shim.getActiveSegment()
      if (!activeSegment) {
        return original.apply(this, arguments)
      }

      const channel = this.channel
      const authorityName = (channel.target && channel.target.path) || channel.getDefaultAuthority

      const segment = shim.createSegment({
        name: `External/${authorityName}${this.methodName}`,
        opaque: true,
        recorder: recordExternal(authorityName, 'gRPC')
      })

      return shim.applySegment(callStart, segment, true, this, arguments)

      function callStart() {
        const args = shim.argsToArray.apply(shim, arguments)

        const transaction = segment.transaction

        const originalMetadata = args[0]
        const nrMetadata = originalMetadata.clone()

        const outboundAgentHeaders = Object.create(null)
        if (shim.agent.config.distributed_tracing.enabled) {
          transaction.insertDistributedTraceHeaders(outboundAgentHeaders)
          Object.keys(outboundAgentHeaders).forEach((key) => {
            nrMetadata.add(key, outboundAgentHeaders[key])
          })
        } else {
          shim.logger.debug('Distributed tracing disabled by instrumentation.')
        }

        args[0] = nrMetadata

        const originalListener = args[1]
        const nrListener = Object.assign({}, originalListener)
        nrListener.onReceiveStatus = (status) => {
          const { code, details } = status

          segment.addAttribute('grpc.statusCode', code)
          segment.addAttribute('grpc.statusText', details)

          // Java captures client errors based on status code
          // but has specific gRPC configuration to turn off
          if (code !== 0) {
            // this is currently just creating an error from the details string
            shim.agent.errors.add(segment.transaction, details)
          }

          segment.addAttribute('component', 'gRPC')

          const protocol = 'grpc'

          const url = `${protocol}://${authorityName}${this.methodName}`

          segment.addAttribute('http.url', url)
          segment.addAttribute('http.method', this.methodName)

          segment.end()

          originalListener && originalListener.onReceiveStatus(status)
        }

        args[1] = nrListener

        return original.apply(this, args)
      }
    }
  })
}
