/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const path = require('node:path')
const MessageBrokerDesc = require('#agentlib/message-broker-description.js')
const genericRecorder = require('#agentlib/metrics/recorders/generic.js')
const retrieveHeaders = require('#agentlib/subscribers/aws-sdk/utils/retrieve-headers.js')
const attachHeaders = require('#agentlib/subscribers/aws-sdk/utils/attach-headers.js')

const COMMANDS_TO_INSTRUMENT = [
  'ReceiveMessageCommand',
  'SendMessageCommand',
  'SendMessageBatchCommand'
]

module.exports = {
  init() {
    return true
  },
  fn: sqsMiddleware,
  config: {
    name: 'NewRelicSqsMiddleware',
    step: 'initialize',
    priority: 'high',
    override: true
  }
}

/**
 * Middleware hook that records the middleware chain for supported SQS
 * operations.
 *
 * @type {AwsSdkBoundMiddlewareFunction}
 */
function sqsMiddleware(subscriber, config, next, context) {
  const { commandName } = context
  const { agent } = subscriber

  if (COMMANDS_TO_INSTRUMENT.includes(commandName) === false) {
    subscriber.logger.debug('Not instrumenting command %s', commandName)
    subscriber.opaque = false
    return next
  }

  subscriber.opaque = true
  return function nrSqsMiddleware(...args) {
    const ctx = agent.tracer.getContext()
    if (!ctx.transaction || ctx.transaction.isActive() === false) {
      return next(...args)
    }

    const [command] = args
    const { input: { QueueUrl } } = command
    const destinationName = path.basename(QueueUrl)
    const mode = commandName.startsWith('Send') === true
      ? MessageBrokerDesc.BROKER_MODE_PRODUCE
      : MessageBrokerDesc.BROKER_MODE_CONSUME
    const mbd = new MessageBrokerDesc({
      destinationName,
      mode,
      destinationType: MessageBrokerDesc.DESTINATION_TYPE_QUEUE,
      libraryName: MessageBrokerDesc.LIB_SQS,
    })

    const newCtx = subscriber.createSegment({
      name: mbd.segmentName,
      recorder: genericRecorder,
      ctx
    })
    if (mode === MessageBrokerDesc.BROKER_MODE_PRODUCE) {
      attachHeaders({ message: command.input, context: newCtx, subscriber })
    }

    // Update segment with entity linking attributes.
    const { segment } = newCtx
    const { region, accountId, queue } = urlComponents(QueueUrl)
    segment.addAttribute('messaging.system', 'aws_sqs')
    segment.addAttribute('cloud.region', region)
    segment.addAttribute('cloud.account.id', accountId)
    segment.addAttribute('messaging.destination.name', queue)

    const fn = agent.tracer.bindFunction(next, newCtx, true)
    const result = fn(...args)
    if (mode === MessageBrokerDesc.BROKER_MODE_PRODUCE) {
      return result
    }

    // aws-sdk@3 only returns promises from `.send`.
    return result
      .then((response) => {
        const message = response?.output?.Messages?.[0] || {}
        const headers = retrieveHeaders({ message })
        newCtx.transaction.addDtHeaders({
          headers,
          transport: MessageBrokerDesc.TRANSPORT_TYPE_QUEUE
        })
        return response
      })
  }
}

const urlReg = /\/\/sqs\.(?<region>[\w-]+)\.amazonaws\.com(:\d+)?\/(?<accountId>\d+)\/(?<queue>.+)$/
function urlComponents(queueUrl) {
  const matches = urlReg.exec(queueUrl)
  if (matches?.groups) {
    return matches.groups
  }
  return { region: undefined, accountId: undefined, queue: undefined }
}
