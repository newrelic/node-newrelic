/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const path = require('node:path')
const MessageBrokerDesc = require('#agentlib/message-broker-description.js')
const genericRecorder = require('#agentlib/metrics/recorders/generic.js')

const COMMANDS_TO_INSTRUMENT = [
  'ReceiveMessageCommand',
  'SendMessageCommand',
  'SendMessageBatchCommand'
]
const DT_HEADERS = ['traceparent', 'tracestate', 'newrelic']

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
  },
  internal: {
    attachHeaders,
    retrieveHeaders
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
      const headers = Object.create(null)
      subscriber.insertDTHeaders({ headers, ctx: newCtx, useMqNames: true })
      if (Object.hasOwn(command.input, 'MessageAttributes') === false) {
        command.input.MessageAttributes = {}
      }
      attachHeaders({ message: command.input, headers })
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
        newCtx.transaction.addDtCatHeaders({
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

/**
 * Mutates the `MessageAttributes` attached to `message` by attaching any
 * values attached to the `headers` object as new attributes.
 *
 * @param {object} params Function parameters.
 * @param {object} params.message AWS SQS message object that has
 * `MessageAttributes`.
 * @param {object} params.headers A hash of distributed trace headers to
 * propagate.
 */
function attachHeaders({ message, headers }) {
  // SQS allows a maximum of 10 message attributes.
  const MAX_HEADERS = 10
  const inputAttrsCount = Object.keys(message.MessageAttributes).length

  // Add headers in priority order. If there isn't enough room in the SQS
  // message, this ensures we get the most important header(s) sent if possible.
  const availSlots = MAX_HEADERS - inputAttrsCount
  let i = 1
  for (const header of DT_HEADERS) {
    if (i > availSlots) break
    if (Object.hasOwn(headers, header) === false) continue
    message.MessageAttributes[header] = {
      DataType: 'String',
      StringValue: headers[header]
    }
    i += 1
  }
}

/**
 * Finds any distributed trace headers present on the given SQS message
 * and returns them as a headers object.
 *
 * @param {object} params Function params.
 * @param {object} params.message An SQS message instance.
 *
 * @returns {object} Hash of key value pairs.
 */
function retrieveHeaders({ message }) {
  const headers = Object.create(null)
  const attrs = message.MessageAttributes || {}
  for (const header of DT_HEADERS) {
    if (Object.hasOwn(attrs, header) === false) continue
    headers[header] = attrs[header].StringValue
  }
  return headers
}
