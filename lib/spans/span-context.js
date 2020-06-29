/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const {MAXIMUM_CUSTOM_ATTRIBUTES} = require('../attributes')
const {PrioritizedAttributes, ATTRIBUTE_PRIORITY} = require('../prioritized-attributes')
const {DESTINATIONS} = require('../config/attribute-filter')

// Scoping impacts memoization. We could decide to add a scope instead of including
// spans in segment scope in the future.
const ATTRIBUTE_SCOPE = 'segment'

class SpanContext {
  constructor(intrinsicAttributes, customAttributes) {
    this.intrinsicAttributes = intrinsicAttributes || Object.create(null)

    this.customAttributes =
      customAttributes || new PrioritizedAttributes(ATTRIBUTE_SCOPE, MAXIMUM_CUSTOM_ATTRIBUTES)

    this.ATTRIBUTE_PRIORITY = ATTRIBUTE_PRIORITY
  }

  addIntrinsicAttribute(key, value) {
    this.intrinsicAttributes[key] = value
  }

  addCustomAttribute(key, value, priority) {
    this.customAttributes.addAttribute(
      DESTINATIONS.SPAN_EVENT,
      key,
      value,
      false,
      priority
    )
  }
}

module.exports = SpanContext
