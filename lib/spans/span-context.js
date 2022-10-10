/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { MAXIMUM_CUSTOM_ATTRIBUTES } = require('../attributes')
const { PrioritizedAttributes, ATTRIBUTE_PRIORITY } = require('../prioritized-attributes')
const { DESTINATIONS } = require('../config/attribute-filter')

// Scoping impacts memoization. We could decide to add a scope instead of including
// spans in segment scope in the future.
const ATTRIBUTE_SCOPE = 'segment'

class SpanContext {
  constructor(intrinsicAttributes, customAttributes) {
    this.intrinsicAttributes = intrinsicAttributes || Object.create(null)

    this.customAttributes =
      customAttributes || new PrioritizedAttributes(ATTRIBUTE_SCOPE, MAXIMUM_CUSTOM_ATTRIBUTES)

    this.ATTRIBUTE_PRIORITY = ATTRIBUTE_PRIORITY

    this.hasError = false
    this.errorDetails = null
  }

  addIntrinsicAttribute(key, value) {
    this.intrinsicAttributes[key] = value
  }

  addCustomAttribute(key, value, priority) {
    this.customAttributes.addAttribute(DESTINATIONS.SPAN_EVENT, key, value, false, priority)
  }

  /**
   * Set error details to be potentially be used to create span
   * attributes. Attributes will be created unless the transaction
   * ends with an ignored error status code.
   *
   * Last error wins.
   *
   * @param details
   */
  setError(details) {
    this.hasError = true

    // Error details will be used to create attributes unless the transaction ends
    // with an ignored status code.
    this.errorDetails = details
  }
}

module.exports = SpanContext
