/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const symbols = require('../../symbols')

const common = module.exports

/**
 * @typedef {Object<string, string>} MiddlewareTypeNames
 */
common.MIDDLEWARE_TYPE_NAMES = {
  APPLICATION: 'APPLICATION',
  ERRORWARE: 'ERRORWARE',
  MIDDLEWARE: 'MIDDLEWARE',
  PARAMWARE: 'PARAMWARE',
  ROUTE: 'ROUTE',
  ROUTER: 'ROUTER'
}

/**
 * Retrieves the cached transaction information from the given object if it is
 * available.
 *
 * @private
 * @param {WebFrameworkShim}      shim  - The shim used for this instrumentation.
 * @param {http.IncomingMessage}  req   - The incoming request object.
 * @returns {object?} The transaction information if available, otherwise null.
 */
common.getTransactionInfo = function getTransactionInfo(shim, req) {
  try {
    return req[symbols.transactionInfo] || null
  } catch (e) {
    shim.logger.debug(e, 'Failed to fetch transaction info from req')
    return null
  }
}

/**
 * @param nextDetails
 * @param txInfo
 */
/**
 * Adds the given error to the transaction information if it is actually an error.
 *
 * @private
 * @param {TransactionInfo} txInfo
 *  The transaction context information for the request.
 * @param {*} err
 *  The error to notice.
 */
common.assignError = function assignError(txInfo, err) {
  txInfo.error = err
  txInfo.errorHandled = false
}

/**
 * Determines if the given object is an error according to the shim.
 *
 * @private
 * @param {WebFrameworkShim} shim
 *  The shim used for this web framework.
 * @param {?*} err
 *  The object to check for error-ness.
 * @returns {boolean} True if the given object is an error according to the shim.
 */
common.isError = function isError(shim, err) {
  return err && shim._errorPredicate(err)
}

/**
 * @param {object} shim instance
 * @param {object} req request
 */
common.makeGetReq = function makeGetReq(shim, req) {
  return function getReqFromArgs(shim, fn, name, args) {
    const reqIdx = shim.normalizeIndex(args.length, req)
    if (reqIdx === null || !args[reqIdx]) {
      shim.logger.debug('Can not find request parameter, not recording.')
      return null
    }
    return args[reqIdx]
  }
}
