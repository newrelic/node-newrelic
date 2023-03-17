/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger').child({ component: 'errors_lib' })
const DESTINATIONS = require('../config/attribute-filter').DESTINATIONS
const props = require('../util/properties')
const urltils = require('../util/urltils')
const errorHelper = require('../errors/helper')
const {
  maybeAddQueueAttributes,
  maybeAddExternalAttributes,
  maybeAddDatabaseAttributes,
  maybeAddSyntheticAttributes
} = require('../util/attributes')
const Transaction = require('../transaction')
const ERROR_EXPECTED_PATH = 'error.expected'

class Exception {
  constructor({ error, timestamp, customAttributes, agentAttributes, expected }) {
    this.error = error
    this.timestamp = timestamp || 0
    this.customAttributes = customAttributes || {}
    this.agentAttributes = agentAttributes || {}
    this._expected = expected
    this.errorGroupCallback = null
  }

  getErrorDetails(config) {
    const errorDetails = errorHelper.extractErrorInformation(null, this.error, config)
    errorDetails.expected = this.isExpected(config, errorDetails)

    return errorDetails
  }

  isExpected(config, { type, message }) {
    if (typeof this._expected === 'undefined') {
      this._expected =
        errorHelper.isExpectedErrorClass(config, type) ||
        errorHelper.isExpectedErrorMessage(config, type, message)
    }

    return this._expected
  }
}

/**
 * Given either or both of a transaction and an exception, generate an error
 * trace in the JSON format expected by the collector. Since this will be
 * used by both the HTTP instrumentation, which uses HTTP status codes to
 * determine whether a transaction is in error, and the domain-based error
 * handler, which traps actual instances of Error, try to set sensible
 * defaults for everything.
 *
 * NOTE: this function returns an array, but also conditionally mutates the array
 * to add a "transaction" property with the transaction id to the array, which works
 * because everything's an object in JS. I'm not entirely sure why we do this, but
 * weird enough to make note of
 *
 * @param {Transaction} transaction  The agent transaction, coming from the instrumentatation
 * @param {Exception}   exception    An custom Exception object with the error and other information
 * @param {object}      config       The configuration to use when creating the object
 * @returns {Array} an Array of Error information, [0] -> placeholder,
 *                                                 [1] -> name extracted from error info,
 *                                                 [2] -> extracted error message,
 *                                                 [3] -> extracted error type,
 *                                                 [4] -> attributes
 */
function createError(transaction, exception, config) {
  const error = exception.error
  const { name, message, type } = errorHelper.extractErrorInformation(
    transaction,
    error,
    config,
    urltils
  )

  const params = {
    userAttributes: Object.create(null),
    agentAttributes: Object.create(null),
    intrinsics: Object.create(null)
  }

  if (transaction) {
    // Copy all of the parameters off of the transaction.
    params.intrinsics = transaction.getIntrinsicAttributes()
    const transactionAgentAttributes =
      transaction.trace.attributes.get(DESTINATIONS.ERROR_EVENT) || {}

    // Merge the agent attributes specific to this error event with the transaction attributes
    params.agentAttributes = Object.assign(exception.agentAttributes, transactionAgentAttributes)

    // There should be no attributes to copy in HSM, but check status anyway
    if (!config.high_security) {
      urltils.overwriteParameters(
        transaction.trace.custom.get(DESTINATIONS.ERROR_EVENT),
        params.userAttributes
      )
    }
  }

  maybeAddUserAttributes(params.userAttributes, exception, config)

  params.stack_trace = maybeAddStackTrace(exception, config)

  params.intrinsics[ERROR_EXPECTED_PATH] =
    exception._expected || errorHelper.isExpected(type, message, transaction, config, urltils)

  maybeAddAgentAttributes(params, exception)

  return [0, name, message, type, params]
}

function isValidErrorGroupOutput(output) {
  return (typeof output === 'string' || output instanceof String) && output !== ''
}

function maybeAddAgentAttributes(attributes, exception) {
  if (exception.errorGroupCallback) {
    const callbackInput = {
      'error': exception.error,
      'customAttributes': Object.assign({}, attributes.userAttributes),
      'request.uri': attributes.agentAttributes['request.uri'],
      'http.statusCode': attributes.agentAttributes['http.statusCode'],
      'http.method': attributes.agentAttributes['request.method'],
      'error.expected': attributes.intrinsics[ERROR_EXPECTED_PATH]
    }

    try {
      const callbackOutput = exception.errorGroupCallback(callbackInput)

      if (!isValidErrorGroupOutput(callbackOutput)) {
        logger.warn('Function provided via setErrorGroupCallback return value malformed')
        return
      }

      attributes.agentAttributes['error.group.name'] = callbackOutput
    } catch (err) {
      logger.warn(
        err,
        'Function provided via setErrorGroupCallback failed, not generating `error.group.name`'
      )
    }
  }
}

function maybeAddUserAttributes(userAttributes, exception, config) {
  const customAttributes = exception.customAttributes
  if (!config.high_security && config.api.custom_attributes_enabled && customAttributes) {
    for (const key in customAttributes) {
      if (props.hasOwn(customAttributes, key)) {
        const dest = config.attributeFilter.filterTransaction(DESTINATIONS.ERROR_EVENT, key)
        if (dest & DESTINATIONS.ERROR_EVENT) {
          userAttributes[key] = customAttributes[key]
        }
      }
    }
  }
}

function maybeAddStackTrace(exception, config) {
  const stack = exception.error?.stack
  let parsedStack

  if (stack) {
    parsedStack = ('' + stack).split(/[\n\r]/g)

    if (config.high_security || config.strip_exception_messages.enabled) {
      parsedStack[0] = exception.error.name + ': <redacted>'
    }
  }

  return parsedStack
}

/**
 * Creates a structure for error event that is sent to the collector.
 * The error parameter is an output of the createError() function for a given exception.
 *
 * @param {Transaction} transaction the current transaction
 * @param {Array} error createError() output
 * @param {string} timestamp the timestamp of the error event
 * @param {object} config agent configuration object
 * @returns {Array} an Array of different types of attributes [0] -> intrinsic, [1] -> user/custom, [2] -> agent
 */
function createEvent(transaction, error, timestamp, config) {
  const message = error[2]
  const errorClass = error[3]
  const errorParams = error[4]

  const intrinsicAttributes = _getErrorEventIntrinsicAttrs(
    transaction,
    errorClass,
    message,
    errorParams.intrinsics[ERROR_EXPECTED_PATH],
    timestamp,
    config
  )

  // the error structure created by createError() already performs filtering of custom
  // and agent attributes, so it is ok to just copy them
  const userAttributes = Object.assign(Object.create(null), errorParams.userAttributes)
  const agentAttributes = Object.assign(Object.create(null), errorParams.agentAttributes)

  return [intrinsicAttributes, userAttributes, agentAttributes]
}

// eslint-disable-next-line max-params
function _getErrorEventIntrinsicAttrs(transaction, errorClass, message, expected, timestamp, conf) {
  // the server expects seconds instead of milliseconds
  if (timestamp) {
    timestamp = timestamp / 1000
  }

  const attributes = {
    'type': 'TransactionError',
    'error.class': errorClass,
    'error.message': conf.high_security ? '' : message,
    'timestamp': timestamp,
    'error.expected': expected
  }

  if (transaction) {
    attributes.transactionName = transaction.getFullName()
    attributes.duration = transaction.timer.getDurationInMillis() / 1000

    maybeAddQueueAttributes(transaction, attributes)
    maybeAddExternalAttributes(transaction, attributes)
    maybeAddDatabaseAttributes(transaction, attributes)
    maybeAddSyntheticAttributes(transaction, attributes)

    if (transaction.agent.config.distributed_tracing.enabled) {
      transaction.addDistributedTraceIntrinsics(attributes)
    } else {
      attributes['nr.referringTransactionGuid'] = transaction.referringTransactionGuid
    }

    attributes['nr.transactionGuid'] = transaction.id

    if (transaction.port) {
      attributes.port = transaction.port
    }
  } else {
    attributes.transactionName = 'Unknown'
  }

  return attributes
}

module.exports.createError = createError
module.exports.createEvent = createEvent
module.exports.Exception = Exception
