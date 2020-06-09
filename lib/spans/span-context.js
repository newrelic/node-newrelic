'use strict'

const {Attributes, MAXIMUM_CUSTOM_ATTRIBUTES} = require('../attributes')
const {DESTINATIONS} = require('../config/attribute-filter')

// Scoping impacts memoization. We could decide to add a scope instead of including
// spans in segment scope in the future.
const ATTRIBUTE_SCOPE = 'segment'

class SpanContext {
  constructor(intrinsicAttributes, customAttributes) {
    this.intrinsicAttributes = intrinsicAttributes || Object.create(null)

    this.customAttributes =
      customAttributes || new Attributes(ATTRIBUTE_SCOPE, MAXIMUM_CUSTOM_ATTRIBUTES)
  }

  addIntrinsicAttribute(key, value) {
    this.intrinsicAttributes[key] = value
  }

  addCustomAttribute(key, value, truncateExempt = false) {
    this.customAttributes.addAttribute(
      DESTINATIONS.SPAN_EVENT,
      key,
      value,
      truncateExempt
    )
  }
}

module.exports = SpanContext
