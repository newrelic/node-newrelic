/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const constants = require('../constants')
const { attributesMapper } = require('./utils')
const attrMappings = {
  name: {
    attrs: [constants.ATTR_FAAS_INVOKED_NAME]
  },
  provider: {
    attrs: [constants.ATTR_FAAS_INVOKED_PROVIDER]
  },
  region: {
    attrs: [constants.ATTR_FAAS_INVOKED_REGION, constants.ATTR_AWS_REGION]
  }
}
const getMapping = attributesMapper.bind(attrMappings)

module.exports = {
  getMapping,
}
