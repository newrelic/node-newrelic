/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var DESTINATIONS = require('../config/attribute-filter').DESTINATIONS
var NAMES = require('../metrics/names')
var props = require('../util/properties')
var urltils = require('../util/urltils')
const errorHelper = require('../errors/helper')

class Exception {
  constructor({error, timestamp, customAttributes, agentAttributes}) {
    this.error = error
    this.timestamp = timestamp || 0
    this.customAttributes = customAttributes || {}
    this.agentAttributes = agentAttributes || {}
  }

  getErrorDetails(config) {
    return errorHelper.extractErrorInformation(null, this.error, config)
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
 * @param {Transaction} transaction  The agent transaction, coming from the instrumentatation
 * @param {Exception}   exception    An custom Exception object with the error and other information
 * @param {object}      config       The configuration to use when creating the object
 */
function createError(transaction, exception, config) {
  const error = exception.error
  let {name, message, type} = errorHelper.extractErrorInformation(
    transaction,
    error,
    config,
    urltils
  )

  let params = {
    userAttributes: Object.create(null),
    agentAttributes: Object.create(null),
    intrinsics: Object.create(null)
  }

  if (transaction) {
    // Copy all of the parameters off of the transaction.
    params.intrinsics = transaction.getIntrinsicAttributes()
    let transactionAgentAttributes = transaction.trace.attributes.get(DESTINATIONS.ERROR_EVENT)
    transactionAgentAttributes = transactionAgentAttributes || {}

    // Merge the agent attributes specific to this error event with the transaction attributes
    const agentAttributes = Object.assign(exception.agentAttributes, transactionAgentAttributes)
    params.agentAttributes = agentAttributes

    // There should be no attributes to copy in HSM, but check status anyway
    if (!config.high_security) {
      const custom = transaction.trace.custom.get(DESTINATIONS.ERROR_EVENT)
      urltils.overwriteParameters(custom, params.userAttributes)
    }
  }

  const customAttributes = exception.customAttributes
  if (!config.high_security && config.api.custom_attributes_enabled && customAttributes) {
    for (let key in customAttributes) {
      if (props.hasOwn(customAttributes, key)) {
        const dest = config.attributeFilter.filterTransaction(
          DESTINATIONS.ERROR_EVENT,
          key
        )
        if (dest & DESTINATIONS.ERROR_EVENT) {
          params.userAttributes[key] = customAttributes[key]
        }
      }
    }
  }

  const stack = exception.error && exception.error.stack
  if (stack) {
    params.stack_trace = ('' + stack).split(/[\n\r]/g)
    if (config.high_security || config.strip_exception_messages.enabled) {
      params.stack_trace[0] = exception.error.name + ': <redacted>'
    }
  }

  params.intrinsics['error.expected'] = false
  if (errorHelper.isExpected(type, message, transaction, config, urltils)) {
    params.intrinsics['error.expected'] = true
  }

  let res = [0, name, message, type, params]
  if (transaction) {
    res.transaction = transaction.id
  }
  return res
}

/**
 * Creates a structure for error event that is sent to the collector.
 * The error parameter is an output of the createError() function for a given exception.
 */
function createEvent(transaction, error, timestamp, config) {
  var message = error[2]
  var errorClass = error[3]
  var errorParams = error[4]

  var intrinsicAttributes = _getErrorEventIntrinsicAttrs(
    transaction,
    errorClass,
    message,
    errorParams.intrinsics['error.expected'],
    timestamp,
    config
  )

  // the error structure created by createError() already performs filtering of custom
  // and agent attributes, so it is ok to just copy them
  var userAttributes = Object.assign(Object.create(null), errorParams.userAttributes)
  var agentAttributes = Object.assign(Object.create(null), errorParams.agentAttributes)

  var errorEvent = [
    intrinsicAttributes,
    userAttributes,
    agentAttributes
  ]

  return errorEvent
}

// eslint-disable-next-line max-params
function _getErrorEventIntrinsicAttrs(
  transaction,
  errorClass,
  message,
  expected,
  timestamp,
  conf
) {
  // the server expects seconds instead of milliseconds
  if (timestamp) timestamp = timestamp / 1000

  var attributes = {
    type: "TransactionError",
    "error.class": errorClass,
    "error.message": conf.high_security ? '' : message,
    timestamp: timestamp,
    'error.expected': expected
  }

  if (transaction) {
    attributes.transactionName = transaction.getFullName()
    attributes.duration = transaction.timer.getDurationInMillis() / 1000

    var metric = transaction.metrics.getMetric(NAMES.QUEUETIME)
    if (metric) {
      attributes.queueDuration = metric.total
    }

    metric = transaction.metrics.getMetric(NAMES.EXTERNAL.ALL)
    if (metric) {
      attributes.externalDuration = metric.total
      attributes.externalCallCount = metric.callCount
    }

    metric = transaction.metrics.getMetric(NAMES.DB.ALL)
    if (metric) {
      attributes.databaseDuration = metric.total
      attributes.databaseCallCount = metric.callCount
    }

    if (transaction.syntheticsData) {
      attributes["nr.syntheticsResourceId"] = transaction.syntheticsData.resourceId
      attributes["nr.syntheticsJobId"] = transaction.syntheticsData.jobId
      attributes["nr.syntheticsMonitorId"] = transaction.syntheticsData.monitorId
    }

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
