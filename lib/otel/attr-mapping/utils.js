/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * The intent of these functions is to bind a DSL for retrieving and mapping span attributes.
 *
 *   `attrs`: list of attributes that represent a canonical key. The first value should be the stable attribute defined in a given span spec(i.e. - [`server.address`, `net.peer.name`]) or a function to run on a more complex situation for returning a composable value from multiple attributes.
 *   `mapping`: a function to run on every attribute defined in attrs. It passes in both the active segment and transaction. The use case is mapping an attribute on a segment to something different than the span, or adding a value on the transaction.
 */

/**
 * Utility that finds the first attribute defined in `attrs` on the span attributes.
 *
 * @param {object} params to function
 * @param {Span} params.span span to retrieve value of attribute
 * @param {string} params.key canonical key for a given stable span attribute
 * @returns {string|undefined} value of span attribute or undefined when it does not exist
 */
function getAttr({ key, span }) {
  const { attrs } = this[key] ?? {}
  if (!(attrs && span)) {
    return
  }

  if (typeof attrs === 'function') {
    return attrs({ span })
  } else {
    const attribute = attrs.find((attr) => span.attributes[attr])
    return attribute && span.attributes[attribute]
  }
}

/**
 * Utility that defines a series of mapper functions to run against segments and transactions for a given span attribute.
 *
 * @param {object} params to function
 * @param {string} params.key canonical key to retrieve mapping for a span attribute
 * @param {TraceSegment} params.segment active segment to run a mapping function on
 * @param {Transaction} params.transaction active transaction to run a mapping function on
 * @returns {object} a series of functions to run against span attributes.
 */
function attributesMapper({ key, segment, transaction } = {}) {
  const { mapping, attrs } = this[key] ?? {}
  if (typeof mapping !== 'function' || !attrs) {
    return {}
  }

  const fn = mapping({ segment, transaction })
  if (typeof fn !== 'function') {
    return {}
  }

  return attrs.reduce((map, cur) => {
    map[cur] = fn
    return map
  }, {})
}

/**
 * Helper that binds the attrMapping DSL to the two utility functions
 * @param {object} attrMapping mapping DSL that contains rules for extracting span attributes and mapping data to segments/transaction
 * @returns {object} bound functions for `getAttr` and `attributesMapper`
 */
function createMapper(attrMapping) {
  return {
    getAttr: getAttr.bind(attrMapping),
    attributesMapper: attributesMapper.bind(attrMapping)
  }
}

module.exports = createMapper
