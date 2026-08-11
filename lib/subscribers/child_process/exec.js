/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const childProcess = require('child_process')
const TcBaseSubscriber = require('../tc-base')

module.exports = class ChildProcessExec extends TcBaseSubscriber {
  constructor({ agent, logger, methodName = 'exec' }) {
    super({ agent, logger, packageName: 'child_process', channelName: methodName })
    this.methodName = methodName
  }

  /**
   * Patches `childProcess[methodName]` before binding the store -- guarded so
   * `setupSubscribers()` constructing/enabling this on every agent cycle
   * only ever wraps the method once, ever, per process.
   */
  enable() {
    this.patch()
    super.enable()
  }

  patch() {
    const methodName = this.methodName
    const original = childProcess[methodName]
    if (original.__nr_wrapped === true) {
      return
    }
    const channel = this.channel

    childProcess[methodName] = function wrappedMethod(...args) {
      const lastArg = args[args.length - 1]
      const hasCallback = typeof lastArg === 'function'
      const data = { methodName, callbackName: hasCallback ? lastArg.name || '<anonymous>' : null }

      return hasCallback
        ? channel.traceCallback(original, -1, data, this, ...args)
        : channel.traceSync(original, data, this, ...args)
    }

    for (const symbol of Object.getOwnPropertySymbols(original)) {
      childProcess[methodName][symbol] = original[symbol]
    }
    childProcess[methodName].__nr_wrapped = true
  }

  handleStart(data, ctx) {
    const segment = this.createSegment(ctx, 'child_process.' + data.methodName)
    return segment ? ctx.enterSegment({ segment }) : ctx
  }

  handleAsyncStart(data, ctx) {
    if (!ctx?.segment) {
      return ctx
    }
    ctx.segment.touch()

    const segment = this.createSegment(ctx, 'Callback: ' + data.callbackName)
    if (!segment) {
      return ctx
    }
    data.callbackSegment = segment
    return ctx.enterSegment({ segment })
  }
}
