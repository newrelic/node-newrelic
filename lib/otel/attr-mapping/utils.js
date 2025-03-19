/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

function abstractMapper({ span, fn, attrs }) {
  let value
  let mapping = {}
  if (span) {
    const attr = attrs.find((attr) => span.attributes[attr])
    value = span.attributes[attr]
  } else if (fn) {
    mapping = attrs.reduce((map, cur) => {
      map[cur] = fn
      return map
    }, {})
  }

  return { mapping, value }
}

function attrMapper({ key, span, segment, transaction }) {
  const mapper = this[key]
  if (!mapper) {
    console.log(`No mapping specified for ${key}`)
    return
  }

  const { mapping, attrs, attrMapper } = mapper
  if (attrMapper) {
    return attrMapper({ span })
  }

  let fn
  if (mapping && !span) {
    fn = mapping({ segment, transaction })
  }
  return abstractMapper({ attrs, span, fn })
}

module.exports = {
  abstractMapper,
  attrMapper
}
