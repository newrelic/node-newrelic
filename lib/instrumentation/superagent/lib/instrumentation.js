/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { METHODS } = require('./http-methods')

module.exports = function instrument(shim, superagent) {
  shim.wrapExport(superagent, function wrapRequest(shim, request) {
    if (!shim.isFunction(request)) {
      shim.logger.debug('Not wrapping export, expected a function.')
      return request
    }

    const wrapped = shim.wrapReturn(request, wrapSuperAgentReq)
    Object.assign(wrapped, request)
    shim.wrapReturn(wrapped, METHODS, wrapSuperAgentReq)

    return wrapped
  })

  const proto = superagent.Request && superagent.Request.prototype
  if (proto) {
    shim.wrapReturn(proto, 'request', wrapHttpReq)
    shim.wrap(proto, 'callback', wrapCallback)
    shim.wrap(proto, 'then', wrapThen)
  }
}

function wrapSuperAgentReq(shim, fn, name, req) {
  // If the request already has a segment associated with it, then we'll use that
  // one for future context. If it doesn't we'll bind it to the current segment.
  const segment = shim.getSegment(req) || shim.getActiveSegment()
  if (segment) {
    shim.storeSegment(req, segment)
    shim.bindSegment(req, 'request', segment, false)
  }
}

function wrapHttpReq(shim, fn, name, req) {
  const segment = shim.getSegment(req)
  if (segment) {
    shim.storeSegment(this, segment)
  }
}

function wrapCallback(shim, callback) {
  return function wrappedCallback() {
    const segment = shim.getSegment(this)
    if (segment && segment.transaction.isActive()) {
      shim.bindCallbackSegment(this, '_callback', segment)
    }
    return callback.apply(this, arguments)
  }
}

function wrapThen(shim, then) {
  return function wrappedThen(resolve, reject) {
    const segment = shim.getSegment(this) || shim.getActiveSegment()
    if (!segment) {
      return then.apply(this, arguments)
    }

    return shim.applySegment(then, segment, false, this, [resolve, reject])
  }
}
