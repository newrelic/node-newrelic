/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const constants = require('../constants')
const createMapper = require('./utils')
const attrMappings = {
  msg: {
    attrs: [constants.EXCEPTION_MESSAGE, constants.EXCEPTION_TYPE]
  },
  stack: {
    attrs: [constants.EXCEPTION_STACKTRACE]
  },
}

const { getAttr: exceptionAttr } = createMapper(attrMappings)

module.exports = {
  exceptionAttr
}
