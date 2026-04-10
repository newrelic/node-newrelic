/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const MessageBrokerDesc = require('#agentlib/message-broker-description.js')
const genericRecorder = require('#agentlib/metrics/recorders/generic.js')
const attachHeaders = require('#agentlib/subscribers/aws-sdk/utils/attach-headers.js')

module.exports = {
  init() {
    return true
  },
  fn: snsMiddleware,
  config: {
    name: 'NewRelicSnsMiddleware',
    step: 'initialize',
    priority: 'high',
    override: true
  }
}

/**
 * Middleware hook that records the middleware chain
 * when command is `PublishCommand`.
 *
 * @type {AwsSdkBoundMiddlewareFunction}
 */
function snsMiddleware(subscriber, config, next, context) {
  const { commandName } = context
  const { agent } = subscriber

  if (commandName !== 'PublishCommand') {
    subscriber.logger.debug(`Not instrumenting command ${commandName}.`)
    subscriber.opaque = false
    return next
  }

  subscriber.opaque = true
  return function nrSnsMiddleware(...args) {
    const ctx = agent.tracer.getContext()
    if (!ctx.transaction || ctx.transaction.isActive() === false) {
      return next(...args)
    }

    const [command] = args
    const destinationName =
      command.input.TopicArn ||
      command.input.TargetArn ||
      // Our original shim based instrumentation defaulted to `PhoneNumber`,
      // seemingly as an "obviously bad" value. It really just seems like a
      // value utilized in our test suite. ~ 2026-03-30
      'PhoneNumber'
    const mbd = new MessageBrokerDesc({
      libraryName: MessageBrokerDesc.LIB_SNS,
      destinationType: MessageBrokerDesc.DESTINATION_TYPE_TOPIC,
      destinationName
    })

    const newCtx = subscriber.createSegment({
      name: mbd.segmentName,
      recorder: genericRecorder,
      ctx
    })
    attachHeaders({ message: command.input, context: newCtx, subscriber })

    const fn = agent.tracer.bindFunction(next, newCtx, true)
    return fn(...args)
  }
}
