/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const constants = require('../constants')
const { attributesMapper } = require('./utils')
const attrMappings = {
  msg: {
    attrs: [constants.EXCEPTION_MESSAGE, constants.EXCEPTION_TYPE]
  },
  stack: {
    attrs: [constants.EXCEPTION_STACKTRACE]
  },
}
const getMapping = attributesMapper.bind(attrMappings)

module.exports = {
  getMapping,
}
