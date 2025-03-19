/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * utility that operates in two modes:
 *  1. finds the first attribute in attrs and returns it as a value when a span is provided. used
 *  to get the value of an attribute on span.
 *  2. creates mapping functions for every attribute in attrs and returns a mapping. used to run a mapping function on every span attribute defined in attrs
 *
 *  **Note**: This is exported for testing. This is indirectly used in `attrMapper`
 *
 *  @param {object} params to function
 *  @param {Span} params.span span to retrieve attribute
 *  @param {function} params.fn mapping function to run on a list of attributes
 *  @param {Array} params.attrs list of attributes to map. 1st element should be the stable attribute
 *  @returns {object} { mapping, value }
 */
function abstractMapper({ span, fn, attrs } = {}) {
  let value
  let mapping = {}
  if (span) {
    const attr = attrs.find((attr) => span.attributes[attr])
    if (attr) {
      value = span.attributes[attr]
    }
  } else if (fn) {
    mapping = attrs.reduce((map, cur) => {
      map[cur] = fn
      return map
    }, {})
  }

  return { mapping, value }
}

/**
 * Shared utility that defines a DSL for mapping attributes, and a mapper to run against segments and transactions for a given span attribute.
 *
 * The usage must bind an object that defines the following structure to the function
 *
 *   `attrs`: list of attributes that represent a canonical key. The first value should be the stable attribute defined in a given span spec(i.e. - [`server.address`, `net.peer.name`])
 *   `mapping`: a function to run on every attribute defined in attrs. It passes in both the active segment and transaction. The use case is mapping an attribute on a segment to something different than the span, or adding a value on the tranaction.
 *   `attrMapper`: a custom function to return a value for a canonical key. This is for more complex use cases where it needs to build a value from multiple span attributes(see `url` in the http.js mappings)
 *
 *
 * @param {object} params to function
 * @param {string} params.key canonical key to retrieve mapping for a span attribute
 * @param {Span} params.span when passed in, it will retrieve the appropriate span attribute based on the `attrs`
 * @param {TraceSegment} params.segment active segment to run a mapping function on
 * @param {Transaction} params.transaction active transaction to run a mapping function on
 * @returns {object} { value, mapping }
 */
function attributesMapper({ key, span, segment, transaction } = {}) {
  const attrMapping = this[key]
  if (!attrMapping) {
    return
  }

  const { mapping, attrs, attrMapper } = attrMapping
  if (attrMapper) {
    const value = attrMapper({ span })
    return { value, mapping: {} }
  }

  let fn
  if (mapping && !span) {
    fn = mapping({ segment, transaction })
  }
  return abstractMapper({ attrs, span, fn })
}

module.exports = {
  abstractMapper,
  attributesMapper,
}
