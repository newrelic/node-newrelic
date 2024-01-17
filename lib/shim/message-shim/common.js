/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const common = module.exports

/**
 * Constructs a message segment name from the given message descriptor.
 *
 * @private
 * @param {MessageShim} shim The shim the segment will be constructed by.
 * @param {object} msgDesc The message descriptor.
 * @param {string} action Produce or consume?
 * @returns {string} The generated name of the message segment.
 */
common._nameMessageSegment = function _nameMessageSegment(shim, msgDesc, action) {
  let name =
    shim._metrics.PREFIX +
    shim._metrics.LIBRARY +
    '/' +
    (msgDesc.destinationType || shim.EXCHANGE) +
    '/' +
    action

  if (msgDesc.destinationName) {
    name += shim._metrics.NAMED + msgDesc.destinationName
  } else {
    name += shim._metrics.TEMP
  }

  return name
}
