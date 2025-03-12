/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { MessageSpec } = require('../../shim/specs')
const InstrumentationDescriptor = require('../../instrumentation-descriptor')

// RPC API calls
// https://cloud.google.com/pubsub/docs/reference/rpc
const PUBLISHER_COMMANDS = ['Publish'] // topic.publishMessage(); https://github.com/googleapis/nodejs-pubsub/blob/main/samples/publishMessage.js
const SUBSCRIBER_COMMANDS = ['Pull', 'StreamingPull'] // subClient.pull(request); https://github.com/googleapis/nodejs-pubsub/blob/main/samples/synchronousPull.js

// https://cloud.google.com/iam/docs/full-resource-names
const urlReg = /\/\/(?<region>[\w-]+)\.pubsub\.googleapis\.com\/projects\/(?<projectId>[\w-]+)\/topics\/(?<topic>[\w-]+)/
function urlComponents(topicUrl) {
  const matches = urlReg.exec(topicUrl)
  if (matches?.groups) {
    return matches.groups
  }
  return { region: undefined, accountId: undefined, topic: undefined }
}

/**
 * Middleware hook that records the middleware chain
 *
 * @param {Shim} shim
 * @param config
 * @param {function} next middleware function
 * @param {Object} context
 * @returns {function}
 */
function pubsubMiddleware(shim, config, next, context) {
  if (PUBLISHER_COMMANDS.includes(context.commandName)) {
    return shim.recordProduce(next, getPubsubSpec)
  } else if (SUBSCRIBER_COMMANDS.includes(context.commandName)) {
    return shim.recordConsume(next, getPubsubSpec)
  }
  shim.logger.debug(`Not instrumenting command ${context.commandName}.`)

  return next
}

/**
 * Returns the spec
 *
 * @param {Shim} shim
 * @param {original} original original middleware function
 * @param name
 * @param {Array} args to the middleware function
 * @returns {Object}
 */
function getPubsubSpec(shim, original, name, args) {
  const [command] = args
  const topic = command.input // TODO: check if this is correct
  return new MessageSpec({
    callback: shim.LAST,
    destinationName: topic,
    destinationType: shim.TOPIC,
    opaque: true,
    after({ segment }) {
      const { region, projectId, topicName } = urlComponents(topic)
      segment.addAttribute('messaging.system', 'gcp_pubsub')
      segment.addAttribute('cloud.region', region)
      segment.addAttribute('cloud.account.id', projectId)
      segment.addAttribute('messaging.destination.name', topicName)
    }
  })
}

const pubsubMiddlewareConfig = {
  middleware: pubsubMiddleware,
  init(shim) {
    shim.setLibrary(shim.PUBSUB)
    return true
  },
  type: InstrumentationDescriptor.TYPE_MESSAGE,
  config: {
    name: 'NewRelicPubsubMiddleware',
    step: 'initialize',
    priority: 'high',
    override: true
  }
}

module.exports = instrumentPubSub(shim, )