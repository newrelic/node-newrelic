/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const logger = require('./logger').child({ component: 'synthetics' })
const hashes = require('./util/hashes')
const { isNotEmpty } = require('./util/objects')
const toSnakeCase = require('./util/snake-case')
const toCamelCase = require('./util/camel-case')
const synthetics = module.exports
const NEWRELIC_SYNTHETICS_HEADER = 'x-newrelic-synthetics'
const NEWRELIC_SYNTHETICS_INFO_HEADER = 'x-newrelic-synthetics-info'

const KEYS = ['version', 'accountId', 'resourceId', 'jobId', 'monitorId']

/**
 * Decode the X-NewRelic-Synthetics and X-NewRelic-Synthetics-Info headers
 * and assign to transactions as properties both the raw and decoded values
 *
 * @param {object} config agent config
 * @param {object} transaction The current transaction
 * @param {object} headers raw http headers
 */
synthetics.assignHeadersToTransaction = function processHeaders(config, transaction, headers) {
  const synthHeader = headers[NEWRELIC_SYNTHETICS_HEADER]
  const synthInfoHeader = headers[NEWRELIC_SYNTHETICS_INFO_HEADER]

  if (synthHeader && config.trusted_account_ids && config.encoding_key) {
    assignSyntheticsHeader(
      synthHeader,
      config.encoding_key,
      config.trusted_account_ids,
      transaction
    )
  }

  if (synthInfoHeader && config.encoding_key) {
    assignSyntheticsInfoHeader(synthInfoHeader, config.encoding_key, transaction)
  }
}

/**
 * Take the X-NewRelic-Synthetics header and apply any appropriate data to the
 * transaction for later use. This is the gate keeper for attributes being
 * added onto the transaction object for synthetics.
 *
 * @param {string} header - The raw X-NewRelic-Synthetics header
 * @param {string} encKey - Encoding key handed down from the server
 * @param {Array.<number>} trustedIds - Array of accounts to trust the header from.
 * @param {object} transaction - Where the synthetics data is attached to.
 */
function assignSyntheticsHeader(header, encKey, trustedIds, transaction) {
  const synthData = parseSyntheticsHeader(header, encKey, trustedIds)
  if (!synthData) {
    return
  }

  transaction.syntheticsData = synthData
  transaction.syntheticsHeader = header
}

/**
 * Take the X-NewRelic-Synthetics-Info header and apply any appropriate data to the
 * transaction for later use. This is the gate keeper for attributes being
 * added onto the transaction object for synthetics info.
 *
 * @param {string} header - The raw X-NewRelic-Synthetics-Info header
 * @param {string} encKey - Encoding key handed down from the server
 * @param {object} transaction - Where the synthetics data is attached to.
 */
function assignSyntheticsInfoHeader(header, encKey, transaction) {
  const synthInfoData = parseSyntheticsInfoHeader(header, encKey)
  if (!synthInfoData) {
    return
  }

  transaction.syntheticsInfoData = synthInfoData
  transaction.syntheticsInfoHeader = header
}

/**
 * Parse out and verify the the pieces of the X-NewRelic-Synthetics-Info header.
 *
 * @param {string} header - The raw X-NewRelic-Synthetics-Info header
 * @param {string} encKey - Encoding key handed down from the server
 * @returns {object | undefined} - On successful parse and verification an object of
 *                            synthetics info data is returned, otherwise undefined is
 *                            returned.
 */
function parseSyntheticsInfoHeader(header, encKey) {
  let synthInfoData = null
  try {
    synthInfoData = JSON.parse(hashes.deobfuscateNameUsingKey(header, encKey))
    logger.trace('Parsed synthetics info header: %s', synthInfoData)
  } catch (e) {
    logger.trace(e, 'Cannot parse synthetics info header: %s', header)
    return
  }

  if (!isNotEmpty(synthInfoData)) {
    logger.trace('Synthetics info data is not an object.')
    return
  }

  const { version } = synthInfoData

  if (version !== 1) {
    logger.trace('Synthetics info header version is not 1, got: %s', version)
    return
  }

  return synthInfoData
}

/**
 * Parse out and verify the the pieces of the X-NewRelic-Synthetics header.
 *
 * @param {string} header - The raw X-NewRelic-Synthetics header
 * @param {string} encKey - Encoding key handed down from the server
 * @param {Array.<number>} trustedIds - Array of accounts to trust the header from.
 * @returns {object | undefined} - On successful parse and verification an object of
 *                            synthetics data is returned, otherwise undefined is
 *                            returned.
 */
function parseSyntheticsHeader(header, encKey, trustedIds) {
  let synthData = null
  try {
    synthData = JSON.parse(hashes.deobfuscateNameUsingKey(header, encKey))
    logger.trace('Parsed synthetics header: %s', synthData)
  } catch (e) {
    logger.trace(e, 'Cannot parse synthetics header: %s', header)
    return
  }

  if (!Array.isArray(synthData)) {
    logger.trace('Synthetics data is not an array.')
    return
  }

  if (synthData.length < KEYS.length) {
    logger.trace(
      'Synthetics header length is %s, expected at least %s',
      synthData.length,
      KEYS.length
    )
  }

  const [version, accountId, resourceId, jobId, monitorId] = synthData

  if (version !== 1) {
    logger.trace('Synthetics header version is not 1, got: %s', version)
    return
  }

  if (accountId && !trustedIds.includes(accountId)) {
    logger.trace(
      'Synthetics header account ID is not in trusted account IDs: %s (%s)',
      accountId,
      trustedIds.toString()
    )
    return
  }

  return {
    version,
    accountId,
    resourceId,
    jobId,
    monitorId
  }
}

/**
 * Helper method for adding relevant synthetics intrinsics to transaction traces
 *
 * @param {object} transaction The current transaction
 */
synthetics.assignIntrinsicsToTransaction = function assignIntrinsicsToTransaction(transaction) {
  if (transaction.syntheticsData) {
    transaction._intrinsicAttributes.synthetics_resource_id = transaction.syntheticsData?.resourceId
    transaction._intrinsicAttributes.synthetics_job_id = transaction.syntheticsData?.jobId
    transaction._intrinsicAttributes.synthetics_monitor_id = transaction.syntheticsData?.monitorId

    if (transaction.syntheticsInfoData) {
      transaction._intrinsicAttributes.synthetics_type = transaction.syntheticsInfoData?.type
      transaction._intrinsicAttributes.synthetics_initiator =
        transaction.syntheticsInfoData?.initiator

      for (const [key, value] of Object.entries(transaction.syntheticsInfoData.attributes)) {
        transaction._intrinsicAttributes[`synthetics_${toSnakeCase(key)}`] = value
      }
    }
  }
}

/**
 * Helper method for modifying attributes by reference if transaction has Synthetics metrics
 *
 * @param {object} transaction The current transaction
 * @param {object} attributes The attributes object to modify (by reference)
 */
synthetics.assignTransactionAttrs = function assignTransactionAttrs(transaction, attributes) {
  if (transaction.syntheticsData) {
    attributes['nr.syntheticsResourceId'] = transaction.syntheticsData?.resourceId
    attributes['nr.syntheticsJobId'] = transaction.syntheticsData?.jobId
    attributes['nr.syntheticsMonitorId'] = transaction.syntheticsData?.monitorId

    if (transaction.syntheticsInfoData) {
      attributes['nr.syntheticsType'] = transaction.syntheticsInfoData?.type
      attributes['nr.syntheticsInitiator'] = transaction.syntheticsInfoData?.initiator
      for (const [key, value] of Object.entries(transaction.syntheticsInfoData.attributes)) {
        const attr = toCamelCase(`synthetics_${key}`)
        attributes[`nr.${attr}`] = value
      }
    }
  }
}

/**
 * Helper method for assign the X-NewRelic-Synthetics and X-NewRelic-Synthetics-Info headers to outbound http requests
 *
 * @param {object} config agent config
 * @param {object} transaction The current transaction
 * @param {object} headers outgoing headers
 */
synthetics.assignHeadersToOutgoingRequest = function addHeadersToOutgoingRequest(
  config,
  transaction,
  headers
) {
  if (config.encoding_key && transaction.syntheticsHeader) {
    headers[NEWRELIC_SYNTHETICS_HEADER] = transaction.syntheticsHeader

    if (transaction.syntheticsInfoHeader) {
      headers[NEWRELIC_SYNTHETICS_INFO_HEADER] = transaction.syntheticsInfoHeader
    }
  }
}

/**
 * Helper method for assigning the X-NewRelic-Synthetics and X-NewRelic-Synthetics-Info headers to the response
 *
 * @param {object} response http response object
 * @param {object} transaction The current transaction
 */
synthetics.assignHeadersToResponse = function assignHeadersToResponse(response, transaction) {
  if (transaction.syntheticsHeader) {
    response.setHeader(NEWRELIC_SYNTHETICS_HEADER, transaction.syntheticsHeader)
    if (transaction.syntheticsInfoHeader) {
      response.setHeader(NEWRELIC_SYNTHETICS_INFO_HEADER, transaction.syntheticsInfoHeader)
    }
  }
}
