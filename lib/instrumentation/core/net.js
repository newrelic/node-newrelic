/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = function initialize(agent, net, moduleName, shim) {
  shim.wrap(net, ['connect', 'createConnection'], wrapCreate)
  function wrapCreate(shim, fn, name) {
    return function wrappedCreateConnection() {
      const segment = shim.getActiveSegment()
      if (!segment) {
        return fn.apply(this, arguments)
      }

      const child = shim.createSegment({ name: 'net.' + name, parent: segment })
      return shim.applySegment(fn, child, true, this, arguments)
    }
  }

  const serverProto = net.Server.prototype

  shim.wrap(serverProto, '_listen2', wrapListen2)
  shim.wrap(net.Socket.prototype, 'connect', wrapConnect)

  function wrapListen2(shim, fn) {
    return function wrappedListen2() {
      const context = shim.tracer.getContext()
      const segment = shim.getActiveSegment()
      const emit = this.emit

      if (!segment || !emit) {
        return fn.apply(this, arguments)
      }

      this.emit = wrappedEmit

      return fn.apply(this, arguments)

      function wrappedEmit(ev, socket) {
        if (ev !== 'connection' || !socket || !socket._handle) {
          return emit.apply(this, arguments)
        }

        const child = shim.createSegment({ name: 'net.Server.onconnection', parent: segment })

        const newContext = context.enterSegment({ segment: child })
        if (socket._handle.onread) {
          shim.bindContext({ nodule: socket._handle, property: 'onread', context: newContext })
        }

        return shim.applyContext({
          func: emit,
          context: newContext,
          full: true,
          boundThis: this,
          args: arguments
        })
      }
    }
  }

  function wrapConnect(shim, fn) {
    return function connectWrapper() {
      if (!agent.getTransaction()) {
        return fn.apply(this, arguments)
      }
      const context = agent.tracer.getContext()

      const socket = this

      const segment = shim.createSegment({ name: 'net.Socket.connect', parent: context.segment })

      const result = shim.applySegment(fn, segment, true, this, arguments)

      shim.bindSegment(socket, 'emit', segment)

      return result
    }
  }
}
