/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// eslint-disable-next-line n/no-unsupported-features/node-builtins
const { tracingChannel } = require('node:diagnostics_channel')
const defaultLogger = require('#agentlib/logger.js').child({ component: 'child_process' })

const channels = {
  exec: tracingChannel('child_process.exec'),
  execFile: tracingChannel('child_process.execFile')
}

class ChildProcessInstrumentation {
  constructor(agent) {
    this.tracer = agent.tracer
    this.store = this.tracer._contextManager._asyncLocalStorage
    this.originals = {}
  }

  patch(childProcess) {
    this.childProcess = childProcess

    for (const [methodName, channel] of Object.entries(channels)) {
      const original = childProcess[methodName]
      this.originals[methodName] = original
      const tracer = this.tracer

      childProcess[methodName] = function wrappedMethod(...args) {
        const ctx = tracer.getContext()
        if (!ctx?.transaction?.isActive()) {
          return original.apply(this, args)
        }

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
    }
  }

  // TODO: this can be extracted to be used by other core instrumentation
  // as we refactor them to use tracing channel
  createSegment(ctx, name) {
    const segment = this.tracer.createSegment({ name, parent: ctx?.segment, transaction: ctx?.transaction })
    if (segment) {
      segment.start()
    }
    return segment
  }

  bindStore() {
    const { tracer, store } = this

    for (const channel of Object.values(channels)) {
      channel.start.bindStore(store, (data) => {
        const ctx = tracer.getContext()
        const segment = this.createSegment(ctx, 'child_process.' + data.methodName)
        data.ctx = segment ? ctx.enterSegment({ segment }) : ctx
        return data.ctx
      })

      channel.asyncStart.bindStore(store, (data) => {
        const { ctx, callbackName } = data
        ctx.segment.touch()

        const segment = this.createSegment(ctx, 'Callback: ' + callbackName)
        data.callbackSegment = segment
        return ctx.enterSegment({ segment })
      })
    }
  }

  teardown() {
    for (const [methodName, channel] of Object.entries(channels)) {
      if (this.originals[methodName]) {
        this.childProcess[methodName] = this.originals[methodName]
      }
      channel.start.unbindStore(this.store)
      channel.asyncStart.unbindStore(this.store)
    }
  }
}

module.exports = function initialize(agent, childProcess, { logger = defaultLogger } = {}) {
  if (!childProcess) {
    logger.debug('Could not find child_process, not instrumenting')
    return false
  }

  const instrumentation = new ChildProcessInstrumentation(agent)
  instrumentation.patch(childProcess)
  instrumentation.bindStore()
  return instrumentation
}

// `end`/`asyncEnd` are agent-agnostic (operate only on what's already
// stashed on `data` by the bindStore transforms above), so unlike
// `start`/`asyncStart` they only ever need to be subscribed once.
for (const channel of Object.values(channels)) {
  channel.subscribe({
    end(data) {
      data.ctx?.segment?.touch()
    },
    asyncEnd(data) {
      data.callbackSegment?.touch()
    }
  })
}
