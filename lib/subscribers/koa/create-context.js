/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { transactionInfo, koaRouter } = require('#agentlib/symbols.js')
const Subscriber = require('../base')

/**
 * Intercepts koa's `createContext` return value to wrap `ctx.response._body` and
 * `ctx.response.status` setters, calling `nameState.markPath()` when the response
 * body or status is set. This is required for correct transaction naming when koa
 * middleware manually appends paths before setting the response.
 */
class KoaCreateContextSubscriber extends Subscriber {
  constructor({ agent, logger, packageName = 'koa' }) {
    super({ agent, logger, packageName, channelName: 'nr_createContext' })
    this.events = ['end']
    this.requireActiveTx = false
  }

  end(data) {
    const ctx = data?.result

    // Intercept _matchedRoute for @koa/router transaction naming.
    // Each time a layer is matched, koa-router sets ctx._matchedRoute = layer.path.
    // We pop the previous path, append the new one, and mark it so the last matched
    // layer's path becomes the transaction name (even when multiple layers match).
    let matchedRoute
    Object.defineProperty(ctx, '_matchedRoute', {
      get() { return matchedRoute },
      set(val) {
        if (val) {
          const txInfo = ctx.req[transactionInfo]
          if (txInfo?.transaction) {
            const prevStored = matchedRoute instanceof RegExp ? matchedRoute.source : matchedRoute
            const toAppend = val instanceof RegExp ? val.source : val
            txInfo.transaction.nameState.popPath(prevStored)
            txInfo.transaction.nameState.appendPath(toAppend)
            txInfo.transaction.nameState.markPath()
            ctx[koaRouter] = true
          }
        }
        matchedRoute = val
      },
      configurable: true
    })

    let koaBodySet = false

    // Wrap _body (internal storage for ctx.body / ctx.response.body)
    let bodyValue = ctx.response.body
    Object.defineProperty(ctx.response, '_body', {
      get() { return bodyValue },
      set(val) {
        if (!ctx[koaRouter]) {
          const txInfo = ctx.req[transactionInfo]
          if (txInfo?.transaction) {
            txInfo.transaction.nameState.markPath()
          }
        }
        bodyValue = val
        koaBodySet = true
      },
      configurable: true,
      enumerable: true
    })

    // Wrap status setter — fallback for responses with a status code but no body
    const statusDescriptor = this.#getInheritedPropertyDescriptor(ctx.response, 'status')
    Object.defineProperty(ctx.response, 'status', {
      get() { return statusDescriptor.get.call(this) },
      set(val) {
        if (!koaBodySet && !ctx[koaRouter]) {
          const txInfo = ctx.req[transactionInfo]
          if (txInfo?.transaction) {
            txInfo.transaction.nameState.markPath()
          }
        }
        return statusDescriptor.set.call(this, val)
      },
      configurable: true
    })
  }

  #getInheritedPropertyDescriptor(obj, property) {
    let proto = obj
    let descriptor = null
    do {
      descriptor = Object.getOwnPropertyDescriptor(proto, property)
      proto = Object.getPrototypeOf(proto)
    } while (!descriptor && proto)
    return descriptor
  }
}

module.exports = KoaCreateContextSubscriber
