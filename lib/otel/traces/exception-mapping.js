/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const constants = require('./constants.js')
const attrMappings = {
  msg: {
    attrs: [constants.EXCEPTION_MESSAGE, constants.EXCEPTION_TYPE]
  },
  stack: {
    attrs: [constants.EXCEPTION_STACKTRACE]
  },
}

module.exports = function exceptionAttr({ key, span }) {
  const { attrs } = attrMappings[key] ?? {}
  if (!(attrs && span)) {
    return
  }

  const attribute = attrs.find((attr) => span.attributes[attr])
  return attribute && span.attributes[attribute]
}
