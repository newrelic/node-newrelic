/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// eslint-disable-next-line n/no-unsupported-features/node-builtins
const { tracingChannel } = require('node:diagnostics_channel')
const logger = require('../../logger').child({ component: 'child_process' })

// Create channels based on instrumented methods
const methods = ['exec', 'execFile']
const channels = new Map(methods.map((name) => [name, tracingChannel('child_process.' + name)]))

// Patched once per process and never unwrapped; each `initialize()` call
// just re-points the bound store at the current agent.
let patched = false
let currentTracer = null
let boundStore = null

module.exports = initialize

function initialize(agent, childProcess) {
  if (!childProcess) {
    logger.debug('Could not find child_process, not instrumenting')
    return false
  }

  patch(childProcess)
  rebindStore(agent)
}

function patch(childProcess) {
  if (patched === true) {
    return
  }
  patched = true

  for (const [methodName, channel] of channels) {
    const original = childProcess[methodName]

    childProcess[methodName] = function wrappedMethod(...args) {
      const ctx = currentTracer?.getContext()
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
// TODO: This can be repurposed for other core instrumentation
// refactors over to tracing channel.
function createSegment(tracer, ctx, name) {
  const segment = tracer.createSegment({ name, parent: ctx?.segment, transaction: ctx?.transaction })
  if (segment) {
    segment.start()
  }
  return segment
}

function rebindStore(agent) {
  const tracer = agent.tracer
  const store = tracer._contextManager._asyncLocalStorage

  for (const channel of channels.values()) {
    if (boundStore && boundStore !== store) {
      channel.start.unbindStore(boundStore)
      channel.asyncStart.unbindStore(boundStore)
    }

    channel.start.bindStore(store, (data) => {
      const ctx = tracer.getContext()
      const segment = createSegment(tracer, ctx, 'child_process.' + data.methodName)
      data.ctx = segment ? ctx.enterSegment({ segment }) : ctx
      return data.ctx
    })

    channel.asyncStart.bindStore(store, (data) => {
      const ctx = data.ctx
      ctx.segment.touch()

      const callbackSegment = createSegment(tracer, ctx, 'Callback: ' + data.callbackName)
      data.callbackSegment = callbackSegment
      return ctx.enterSegment({ segment: callbackSegment })
    })
  }

  boundStore = store
  currentTracer = tracer
}

// `end`/`asyncEnd` run once at module load and don't need
// agent.tracer (segment is already created within `data`),
// while `start`/`asyncStart` are handled inside rebindStore().
for (const channel of channels.values()) {
  channel.subscribe({
    end(data) {
      data.ctx?.segment?.touch()
    },
    asyncEnd(data) {
      data.callbackSegment?.touch()
    }
  })
}
