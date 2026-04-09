/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = attachHeaders

const { DT_HEADERS } = require('./constants.js')

/**
 * Mutates the `MessageAttributes` attached to `message` by attaching any
 * values attached to the `headers` object as new attributes.
 *
 * @param {object} params Function parameters.
 * @param {object} params.message AWS message object that has
 * `MessageAttributes`.
 * @param {object} params.headers A hash of distributed trace headers to
 * propagate.
 */
function attachHeaders({ message, headers }) {
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
