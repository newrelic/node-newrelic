/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const mapToStreamingType = require('./map-to-streaming-type')

/**
 * Specialized attribute collection class for use with infinite streaming.
 * Currently designed to be sent over grpc via the v1.proto definition.
 *
 * @private
 * @class
 */
class StreamingSpanAttributes {
  constructor(attributes) {
    if (attributes) {
      this.addAttributes(attributes)
    }
  }

  /**
   * Add a key/value pair to the attribute collection.
   * null/undefined values will be dropped.
   *
   * Does not apply filtering/truncation.
   *
   * @param {string} key Name of the attribute to be stored.
   * @param {string|boolean|number} value Value of the attribute to be stored.
   */
  addAttribute(key, value) {
    const streamingValue = mapToStreamingType(value)
    if (streamingValue) {
      this[key] = streamingValue
      return true
    }

    return false
  }

  /**
   * Adds all attributes in an object to the attribute collection.
   * null/undefined values will be dropped.
   *
   * Does not apply filtering/truncation.
   *
   * @param {object} [attributes]
   * @param {string} [attributes.key] Name of the attribute to be stored.
   * @param {string|boolean|number} [attributes.value] Value of the attribute to be stored.
   */
  addAttributes(attributes) {
    if (!attributes) {
      return
    }

    for (const [key, value] of Object.entries(attributes)) {
      this.addAttribute(key, value)
    }
  }
}

module.exports = StreamingSpanAttributes
