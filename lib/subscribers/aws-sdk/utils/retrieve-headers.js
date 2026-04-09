/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = retrieveHeaders

const { DT_HEADERS } = require('./constants.js')

/**
 * Finds any distributed trace headers present on the given AWS message
 * object and returns them as a key-value hash.
 *
 * @param {object} params Function params.
 * @param {object} params.message An AWS message instance.
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
