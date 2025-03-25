/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const constants = require('../constants')
const createMapper = require('./utils')
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
const { getAttr: faasAttr } = createMapper(attrMappings)

module.exports = {
  faasAttr
}
