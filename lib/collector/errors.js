/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const ERR_CODES = {
  NR_UNKNOWN_ERROR: 'NR_UNKNOWN_ERROR',
  NR_REMOTE_METHOD_CONSTRUCT: 'NR_REMOTE_METHOD_CONSTRUCT',
  NR_REMOTE_METHOD_MAX_PAYLOAD_SIZE_EXCEEDED: 'NR_REMOTE_METHOD_MAX_PAYLOAD_SIZE_EXCEEDED',
  NR_REMOTE_METHOD_MISSING_REQUIRED_PARAM: 'NR_REMOTE_METHOD_MISSING_REQUIRED_PARAM'
}
module.exports.ERR_CODES = ERR_CODES

module.exports.constructionError = function constructionError(msg, code) {
  const error = new TypeError(msg)
  error.code = code ?? ERR_CODES.NR_UNKNOWN_ERROR
  return error
}

module.exports.generalError = function generalError(msg, code) {
  const error = new Error(msg)
  error.code = code ?? ERR_CODES.NR_UNKNOWN_ERROR
  return error
}
