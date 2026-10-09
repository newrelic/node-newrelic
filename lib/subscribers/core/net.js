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

  end(data) {
    const { result, wrapOnRead, bindSocket, socket } = data
    const ctx = this.agent.tracer.getContext()

    if (!this.agent.getTransaction()) {
      return
    }

    if (wrapOnRead && typeof socket?._handle?.onread === 'function') {
      socket._handle.onread = this.agent.tracer.bindFunction(socket._handle.onread, ctx)
    }

    if (bindSocket) {
      result.emit = this.agent.tracer.bindFunction(result.emit, ctx)
    }

    return super.end(data)
  }

  instrument(net) {
    this.#wrapCreate(net)
    this.#wrapEmit(net.Server.prototype)
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

  #wrapEmit(serverProto) {
    const self = this
    shimmer.wrapMethod(serverProto, 'net.Server.prototype', 'emit', function wrapEmit(emit) {
      const channel = tracingChannel(`${self.id}:${SERVER_ON_CONNECTION}`)
      return function wrappedEmit(...args) {
        const [ev, socket] = args
        const ctx = self.agent.tracer.getContext()
        if (ev !== 'connection' || !ctx?.transaction?.isActive() || !socket?._handle) {
          return emit.apply(this, args)
        }

        const data = { name: `${self.packageName}.${SERVER_ON_CONNECTION}`, wrapOnRead: true, socket }
        return channel.traceSync(emit, data, this, ...args)
      }
    })
  }

  #wrapConnect(socketProto) {
    const self = this
    shimmer.wrapMethod(socketProto, 'net.Socket.prototype', 'connect', function wrapConnect(original) {
      const channel = tracingChannel(`${self.id}:${SOCKET_CONNECT}`)
      return function connectWrapper() {
        const data = { name: `${self.packageName}.${SOCKET_CONNECT}`, bindSocket: true }

        return channel.traceSync(original, data, this, ...arguments)
      }
    })
  }
}

module.exports = NetSubscriber
