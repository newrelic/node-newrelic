/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const UNKNOWN = 'Unknown'
const { NR_CONFIG } = require('./smithy-client')

function wrapConstructStack(shim, constructStack) {
  return function wrappedConstructStack(...args) {
    const stack = constructStack.apply(this, args)
    if (!shim.isWrapped(stack.resolve)) {
      shim.wrap(stack, 'resolve', wrapResolve)
    }

    if (!shim.isWrapped(stack.clone)) {
      shim.wrap(stack, 'clone', wrapClone)
    }

    if (!shim.isWrapped(stack.concat)) {
      shim.wrap(stack, 'concat', wrapClone)
    }

    return stack
  }
}

function wrapClone(shim, clone) {
  return function wrappedClone(...args) {
    const stack = clone.apply(this, args)
    wrapConstructStack(shim, stack)
    return stack
  }
}

function wrapResolve(shim, resolve) {
  return function wrappedResolve(...resolveArgs) {
    const [, ctx] = resolveArgs
    const handler = resolve.apply(this, resolveArgs)
    return async function patchedHandler(...handlerArgs) {
      let config
      let region
      try {
        const [command] = handlerArgs
        config = command[NR_CONFIG]
        region = await config.region()
      } catch (err) {
        shim.logger.error(err, 'Failed to get the AWS config and region')
      } finally {
        const result = await handler.apply(this, handlerArgs)
        const { response } = result
        const segment = shim.getSegment(response.body.req)
        segment.addAttribute('aws.operation', ctx.commandName || UNKNOWN)
        segment.addAttribute('aws.requestId', response.headers['x-amzn-requestid'] || UNKNOWN)
        segment.addAttribute('aws.service', config.serviceId || UNKNOWN)
        segment.addAttribute('aws.region', region || UNKNOWN)
        return result
      }
    }
  }
}

module.exports = function instrumentMiddlewareStack(shim, mwStack) {
  shim.wrap(mwStack, 'constructStack', wrapConstructStack)
}
