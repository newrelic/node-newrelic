/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const MiddlewareWrapper = require('../middleware-wrapper')
const ALLOWED_METHODS = ['MethodNotAllowedError', 'NotImplementedError']
const { transactionInfo } = require('#agentlib/symbols.js')

class KoaMiddlewareWrapper extends MiddlewareWrapper {
  extractTxInfo(args) {
    const ctx = args.at(-2)
    const txInfo = ctx?.req?.[transactionInfo] || {}
    return { txInfo, request: ctx, errorWare: false }
  }

  /**
   * This is only used to remove the path from nameState
   * `allowedMethod` fires
   *
   * @param {object} txInfo object storing transaction, error, segmentStack(not used in migrated subscribers)
   * @param {Error} err error that occurred
   */
  maybeHandleError(txInfo, err) {
    if (err && ALLOWED_METHODS.includes(err.name)) {
      txInfo.transaction.nameState.popPath()
    }

    super.maybeHandleError(txInfo, err)
  }

  /**
   * Wraps the next handler ands pops route from nameState if it is not a handler.
   * We aren't binding this function to the context, because `next` is another middleware
   * that is already being instrumented.
   *
   * @param {object} params to function
   * @param {Array} params.args arguments to middleware function
   * @param {Context} params.ctx context from the original middleware function
   * @param {string} params.route route registered to middleware handler
   * @param {boolean} params.isLastInRouter flag to indicate the middleware is the final one in a router layer stack
   */
  wrapDoneHandler({ route, isLastInRouter, ctx, args }) {
    const doneFn = args.at(-1)
    function wrappedDone(...doneArgs) {
      if (route && !isLastInRouter) {
        ctx.transaction.nameState.popPath(route)
      }

      return doneFn.apply(this, doneArgs)
    }

    args[args.length - 1] = wrappedDone
  }
}

module.exports = KoaMiddlewareWrapper
