/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const BaseCoreSubscriber = require('./base')
const shimmer = require('../../shimmer')
// eslint-disable-next-line n/no-unsupported-features/node-builtins
const { tracingChannel } = require('node:diagnostics_channel')

const CREATE_METHODS = ['connect', 'createConnection']
const SOCKET_CONNECT = 'Socket.connect'
const SERVER_ON_CONNECTION = 'Server.onconnection'

class NetSubscriber extends BaseCoreSubscriber {
  constructor({ agent, logger }) {
    super({
      agent,
      logger,
      packageName: 'net',
      instrumentedMethods: [...CREATE_METHODS, SOCKET_CONNECT, SERVER_ON_CONNECTION]
    })
  }

  handler(data, ctx) {
    const newCtx = this.createSegment({ name: data.name, ctx })
    if (newCtx !== ctx) {
      data.context = newCtx
    }
    return newCtx
  }

  instrument(net) {
    this.#wrapCreate(net)
    this.#wrapListen2(net.Server.prototype)
    this.#wrapConnect(net.Socket.prototype)
  }

  #wrapCreate(net) {
    const self = this
    shimmer.wrapMethod(net, 'net', CREATE_METHODS, function wrapCreate(original, method) {
      const channel = tracingChannel(`${self.id}:${method}`)
      return function wrappedCreateConnection() {
        const data = { name: `${self.packageName}.${method}` }
        return channel.traceSync(original, data, this, ...arguments)
      }
    })
  }

  #wrapListen2(serverProto) {
    const self = this
    const { tracer } = this.agent
    shimmer.wrapMethod(serverProto, 'net.Server.prototype', '_listen2', function wrapListen2(original) {
      const channel = tracingChannel(`${self.id}:${SERVER_ON_CONNECTION}`)
      return function wrappedListen2() {
        const context = tracer.getContext()
        const segment = context?.transaction?.isActive() ? context.segment : null
        const emit = this.emit

        if (!segment || !emit) {
          return original.apply(this, arguments)
        }

        this.emit = wrappedEmit

        return original.apply(this, arguments)

        function wrappedEmit(ev, socket) {
          if (ev !== 'connection' || !socket || !socket._handle) {
            return emit.apply(this, arguments)
          }

          const data = { name: `${self.packageName}.${SERVER_ON_CONNECTION}` }

          return self.store.run(context, () => channel.traceSync(function emitInContext() {
            if (data.context && socket._handle.onread) {
              socket._handle.onread = tracer.bindFunction(socket._handle.onread, data.context)
            }
            return emit.apply(this, arguments)
          }, data, this, ...arguments))
        }
      }
    })
  }

  #wrapConnect(socketProto) {
    const self = this
    const { tracer } = this.agent
    shimmer.wrapMethod(socketProto, 'net.Socket.prototype', 'connect', function wrapConnect(original) {
      const channel = tracingChannel(`${self.id}:${SOCKET_CONNECT}`)
      return function connectWrapper() {
        const socket = this
        const data = { name: `${self.packageName}.${SOCKET_CONNECT}` }

        const result = channel.traceSync(original, data, this, ...arguments)

        if (data.context) {
          socket.emit = tracer.bindFunction(socket.emit, data.context)
        }

        return result
      }
    })
  }
}

module.exports = NetSubscriber
