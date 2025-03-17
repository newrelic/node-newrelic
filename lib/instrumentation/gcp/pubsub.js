/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { MessageSpec } = require('../../shim/specs')

// https://cloud.google.com/iam/docs/full-resource-names
const urlReg = /\/\/(?<region>[\w-]+)\.googleapis\.com/
function urlComponents(topicUrl) {
  const matches = urlReg.exec(topicUrl)
  if (matches?.groups) {
    return matches.groups
  }
  return { region: undefined }
}

function wrapTopic(shim, topic) {
  const proto = topic
  shim.logger.trace('Instrumenting Topic class.')

  shim.recordProduce(proto, 'publishMessage', recordPublishMessaage)
}

function recordPublishMessaage(shim, fn, n, args) {
  const fields = args[0]
  if (!fields) {
    return null
  }
  const topic = this
  const pubsub = topic.parent
  const topicName = topic.id_
  return new MessageSpec({
    destinationName: topicName,
    destinationType: shim.TOPIC,
    after({ segment }) {
      // TODO: attributes are not being properly added to the segment
      segment.addAttribute('messaging.system', 'gcp_pubsub')
      const { region } = urlComponents(pubsub.options?.scopes?.[1])
      if (region) {
        segment.addAttribute('cloud.region', region)
      }
      if (pubsub?.projectId) {
        segment.addAttribute('cloud.account.id', pubsub?.projectId)
      }
      segment.addAttribute('messaging.destination.name', topicName)
    }
  })
}

/**
 *
 * Instruments the PubSub library
 *
 * @param {Shim} shim instance of shim
 * @param {*} pubsub pubsub instance
 */
module.exports = function instrumentPubSub(shim, pubsub) {
  const otel = pubsub?.openTelemetry
  // TODO: check out what otel does in this library
  if (!shim.isFunction(pubsub?.Topic?.prototype?.publishMessage)) {
    shim.logger.debug('Could not find PubSub topic, not instrumenting.')
    return
  }

  shim.setLibrary(shim.PUBSUB)
  wrapTopic(shim, pubsub.Topic.prototype)
  // TODO: Instrument Subscription for on() and pull()
  // TODO: Instrument PubSub for topic() and subcription()
}
