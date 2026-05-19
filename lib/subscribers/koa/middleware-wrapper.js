/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { transactionInfo, koaRouter } = require('#agentlib/symbols.js')
const MiddlewareWrapper = require('../middleware-wrapper')

class KoaMiddlewareWrapper extends MiddlewareWrapper {
  constructor({ agent, logger }) {
    super({ agent, logger, system: 'Koa' })
  }

  /**
   * Extracts transaction info from the koa context object.
   * Koa always passes `ctx` as the second-to-last argument: `(ctx, next)` for
   * standard middleware, `(value, ctx, next)` for param handlers. The
   * `IncomingMessage` lives at `ctx.req`, where http instrumentation attaches
   * the `transactionInfo` symbol.
   *
   * @param {Array} args middleware arguments
   * @returns {{ txInfo: object, request: object, errorWare: false }} transaction info and the koa ctx object
   */
  extractTxInfo(args) {
    const ctx = args.at(-2)
    const txInfo = ctx?.req?.[transactionInfo] || {}
    return { txInfo, request: ctx, errorWare: false }
  }

  /**
   * Koa-specific wrap. Key differences from the base class:
   * - `route` defaults to '/' so every middleware gets a path stack entry
   * - `next()` is wrapped via `wrapNextForKoa` to `popPath` before calling and `appendPath`
   *   after resolving, matching the old shim's pop-on-call / re-append-on-resolve
   *   timing that ensures inner middleware `markPath()` snapshots exclude outer routes
   * - wrapDoneHandler is not called — it rebinds `next()` to the parent context,
   *   which breaks segment nesting for promise-returning non-async functions
   * - `txInfo.errorHandled = true` on successful completion, mirroring the old shim's
   *   `afterExec` behaviour so errors caught by upstream middleware are not recorded
   *
   * @param {object} params function parameters
   * @param {Function} params.handler the middleware function to wrap
   * @param {string} [params.prefix] segment name prefix, falls back to `this.prefix`
   * @param {string} [params.route] route path; defaults to '/' when not provided
   * @param {string} [params.segmentName] explicit segment name, bypasses route-based naming
   * @param {boolean} [params.noAppend] when true, skip `appendPath`/`popPath`/`wrapNextForKoa` —
   *   used for router route handlers whose path naming is driven by `_matchedRoute` interception
   * @param {boolean} [params.routerActive] when true, sets `koaRouter` symbol on `ctx` so that
   *   `_body`/`status` setters in `create-context.js` do not override router-driven transaction names
   * @returns {Function} wrapped middleware that records a segment and manages transaction state
   */
  wrap({ handler, prefix, route, segmentName, noAppend = false, routerActive = false }) {
    const self = this

    function wrappedHandler(...args) {
      const ctx = self.agent.tracer.getContext()
      if (ctx?.transaction?.isActive() !== true) {
        self.logger.trace('No active transaction, calling original function')
        return handler.apply(this, args)
      }

      const transaction = ctx.transaction
      transaction.nameState.setPrefix(self.system)
      const { txInfo, request } = self.extractTxInfo(args)

      // Prevents _body/_status setters (create-context.js) from overriding the router's
      // transaction name — only set when this fn IS the router dispatch or allowedMethods wrapper
      if (routerActive && request) {
        request[koaRouter] = true
      }

      // route may be a getter fn (() => layer.path) so router.prefix() can modify
      // layer.path between route registration and the first request
      const resolvedRoute = typeof route === 'function' ? route() : route

      // Unlike the base class (which skips appendPath when route is absent), Koa always
      // appends — defaulting to '/' ensures every middleware appears in the path stack
      const koaRoute = (noAppend || segmentName) ? null : (resolvedRoute || '/')

      // nameSegment receives the route for segment naming:
      // - segmentName overrides entirely (e.g. 'Koa/Router: /')
      // - noAppend handlers (route handlers) are still named by their resolved route
      // - otherwise use koaRoute (which may be '/')
      let nameRoute = koaRoute
      if (segmentName) {
        nameRoute = null
      } else if (noAppend) {
        nameRoute = resolvedRoute
      }

      if (koaRoute) {
        transaction.nameState.appendPath(koaRoute, request?.params)
        // Unlike base class wrapDoneHandler, Koa pops BEFORE next() runs so inner
        // middleware markPath() snapshots don't include the outer route, then re-appends
        // AFTER next() resolves so the outer path is back when ctx.body is set
        wrapNextForKoa({ args, route: koaRoute, transaction })
      }

      const segResult = self.createAndEnterSegment({
        handler, prefix, route: nameRoute, errorWare: false, segmentName, ctx, transaction
      })
      if (!segResult) {
        return handler.apply(this, args)
      }
      const { segment, newCtx } = segResult

      try {
        const result = self.agent.tracer.bindFunction(handler, newCtx, true).apply(this, args)
        if (result?.then) {
          return result.then(
            function onThen(val) {
              if (koaRoute) { transaction.nameState.popPath(koaRoute) }
              // Marks errors caught by upstream middleware as handled so they aren't
              // double-reported — base class omits this since Express surfaces them differently
              txInfo.errorHandled = true
              segment.touch()
              return val
            },
            function onCatch(err) {
              self.storeError(txInfo, err)
              segment.touch()
              throw err
            }
          )
        }
        if (koaRoute) { transaction.nameState.popPath(koaRoute) }
        txInfo.errorHandled = true
        segment.touch()
        return result
      } catch (err) {
        self.storeError(txInfo, err)
        throw err
      }
    }

    Object.defineProperties(wrappedHandler, {
      name: { value: handler.name },
      length: { value: handler.length }
    })
    return wrappedHandler
  }
}

/**
 * Wraps the next() argument in-place so that:
 * - `popPath(route)` fires before `next()` runs (outer path leaves the stack)
 * - `appendPath(route)` fires after `next()` resolves (outer path re-enters the stack)
 * This matches the old shim's `wrapNextFn` timing so that inner middleware `markPath()`
 * snapshots never include the outer route. `next()` is always the last argument in koa
 * middleware signatures.
 *
 * @param {object} params function parameters
 * @param {Array} params.args middleware argument list — `next()` is replaced at the last index
 * @param {string} params.route the stored path string (`RegExp` routes use source) for pop/re-append
 * @param {Transaction} params.transaction the active transaction whose `nameState` is managed
 */
function wrapNextForKoa({ args, route, transaction }) {
  const idx = args.length - 1
  const origNext = args[idx]
  if (typeof origNext !== 'function') { return }
  args[idx] = function wrappedNext(...nextArgs) {
    transaction.nameState.popPath(route)
    return origNext.apply(this, nextArgs).then(function (val) {
      transaction.nameState.appendPath(route)
      return val
    })
  }
}

module.exports = KoaMiddlewareWrapper
