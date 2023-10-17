/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
exports = module.exports = { isSimpleObject, isNotEmpty }

function isSimpleObject(thing) {
  return 'object' === typeof thing && thing !== null
}

function isNotEmpty(thing) {
  return 'object' === typeof thing && thing !== null && Object.keys(thing).length > 0
}
