/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// eslint-disable-next-line n/no-unsupported-features/node-builtins
const { tracingChannel } = require('node:diagnostics_channel')

const BaseCoreSubscriber = require('./base')
const { wrapMethod, wrapMethods } = require('../wrap-method')

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
      this.#bindUntilEnded(socket._handle, 'onread', ctx)
    }

    if (bindSocket) {
      this.#bindUntilEnded(result, 'emit', ctx)
    }

    return super.end(data)
  }

  /**
   * Replaces `target[prop]` with a function that runs within `ctx` for as
   * long as `ctx`'s transaction is active, then permanently restores the
   * original, unbound function -- without keeping `ctx`, and the
   * transaction/trace it references, reachable any longer than that.
   *
   * A socket (and the `data`/`error`/`close` handlers bound to it here) can
   * outlive the transaction that created it by a long time, e.g. a
   * connection sitting idle in a database driver's pool. A normal, strong
   * binding (e.g. `tracer.bindFunction`) would keep that long-ended
   * transaction, and its whole trace, reachable in memory for as long as
   * the socket exists.
   *
   * That revert can only run if `target[prop]` is actually invoked again
   * after the transaction ends. A socket that's reused by a pool but never
   * otherwise emits again before the transaction ends would never get the
   * chance -- so the active context is additionally held via a `WeakRef`,
   * which lets it (and the transaction/trace it references) be collected
   * once nothing else needs it, regardless of whether anything ever
   * invokes this binding again.
   *
   * Once reverted (by either path), later events rely on the native
   * resource's own async-context association being refreshed whenever it's
   * handed to a new logical operation -- e.g. via `handle.asyncReset()`,
   * the same API Node's own `http.Agent` uses for pooled sockets -- for
   * correct behavior.
   *
   * @param {object} target The object whose property should be bound.
   * @param {string} prop The property name to replace.
   * @param {object} ctx The async context active when the handler was
   * captured.
   * @returns {void}
   */
  #bindUntilEnded(target, prop, ctx) {
    const handler = target[prop]
    if (typeof handler !== 'function') {
      return
    }

    const tracer = this.agent.tracer
    const ctxRef = new WeakRef(ctx)
    target[prop] = function nrBoundUntilEnded() {
      const context = ctxRef.deref()
      if (!context?.transaction?.isActive()) {
        target[prop] = handler
        return handler.apply(this, arguments)
      }

      return tracer.runInContext({ handler, context, thisArg: this, args: arguments })
    }
  }

  instrument(net) {
    this.#wrapCreate(net)
    this.#wrapEmit(net.Server.prototype)
    this.#wrapConnect(net.Socket.prototype)
  }

  #wrapCreate(net) {
    const id = this.id
    const packageName = this.packageName
    wrapMethods({
      module: net,
      methodNames: CREATE_METHODS,
      logger: this.logger,
      wrapper: function wrapCreate(original, method) {
        const channel = tracingChannel(`${id}:${method}`)
        return function wrappedCreateConnection() {
          const data = { name: `${packageName}.${method}` }
          return channel.traceSync(original, data, this, ...arguments)
        }
      }
    })
  }

  #wrapEmit(serverProto) {
    const agent = this.agent
    const id = this.id
    const packageName = this.packageName
    wrapMethod({
      module: serverProto,
      methodName: 'emit',
      logger: this.logger,
      wrapper: function wrapEmit(emit) {
        const channel = tracingChannel(`${id}:${SERVER_ON_CONNECTION}`)
        return function wrappedEmit(...args) {
          const [ev, socket] = args
          const ctx = agent.tracer.getContext()
          if (ev !== 'connection' || !ctx?.transaction?.isActive() || !socket?._handle) {
            return emit.apply(this, args)
          }

          const data = { name: `${packageName}.${SERVER_ON_CONNECTION}`, wrapOnRead: true, socket }
          return channel.traceSync(emit, data, this, ...args)
        }
      }
    })
  }

  #wrapConnect(socketProto) {
    const id = this.id
    const packageName = this.packageName
    wrapMethod({
      module: socketProto,
      methodName: 'connect',
      logger: this.logger,
      wrapper: function wrapConnect(original) {
        const channel = tracingChannel(`${id}:${SOCKET_CONNECT}`)
        return function connectWrapper() {
          const data = { name: `${packageName}.${SOCKET_CONNECT}`, bindSocket: true }

          return channel.traceSync(original, data, this, ...arguments)
        }
      }
    })
  }
}

module.exports = NetSubscriber
