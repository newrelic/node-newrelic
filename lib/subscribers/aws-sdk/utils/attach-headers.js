/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = attachHeaders

const { DT_HEADERS } = require('./constants.js')

/**
 * Mutates the `MessageAttributes` attached to `message` by attaching any
 * distributed trace headers present within the current context.
 *
 * @param {object} params Function parameters.
 * @param {object} params.message AWS message object that has
 * `MessageAttributes`.
 * @param {AsyncContext} params.context Context for the current request.
 * @param {SmithyClientSendSubscriber} params.subscriber Subscriber instance
 * handling the request.
 */
function attachHeaders({ message, context, subscriber }) {
  const headers = Object.create(null)
  subscriber.insertDTHeaders({ headers, ctx: context })
  // We can't use an `Object.hasOwn` check here because some users build
  // the message object such that `MessageAttributes: undefined` happens.
  // This "breaks" the `hasOwn` check because technically the object has
  // the property set. It's just set to a falsy value.
  if (!message.MessageAttributes) {
    message.MessageAttributes = {}
  }

  // AWS allows a maximum of 10 message attributes.
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
