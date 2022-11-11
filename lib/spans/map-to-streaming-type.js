/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const STRING_TYPE = 'string_value'
const BOOL_TYPE = 'bool_value'
const INT_TYPE = 'int_value'
const DOUBLE_TYPE = 'double_value'

function mapToStreamingType(value) {
  if (value === null || value === undefined) {
    return
  }

  const valueType = typeof value

  let protoTypeString = null
  switch (valueType) {
    case 'string': {
      protoTypeString = STRING_TYPE
      break
    }
    case 'boolean': {
      protoTypeString = BOOL_TYPE
      break
    }
    case 'number': {
      const isInteger = Number.isInteger(value)
      protoTypeString = isInteger ? INT_TYPE : DOUBLE_TYPE
      break
    }
    default: {
      protoTypeString = null
    }
  }

  if (protoTypeString) {
    return {
      [protoTypeString]: value
    }
  }
}

module.exports = mapToStreamingType
