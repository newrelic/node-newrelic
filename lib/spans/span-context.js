'use strict'

class SpanContext {
  constructor(intrinsicAttributes) {
    this.intrinsicAttributes = intrinsicAttributes || Object.create(null)
  }

  addIntrinsicAttribute(key, value) {
    this.intrinsicAttributes[key] = value
  }
}

module.exports = SpanContext
