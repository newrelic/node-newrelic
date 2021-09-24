/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const cat = module.exports
const hashes = require('./hashes')
const logger = require('../logger').child({ component: 'cat' })
const NAMES = require('../metrics/names')

const HTTP_CAT_ID_HEADER = 'X-NewRelic-Id'
const MQ_CAT_ID_HEADER = 'NewRelicID'
const MATCH_CAT_ID_HEADER = new RegExp(
  '^(?:' + HTTP_CAT_ID_HEADER + '|' + MQ_CAT_ID_HEADER + ')$',
  'i'
)
const HTTP_CAT_TRANSACTION_HEADER = 'X-NewRelic-Transaction'
const MQ_CAT_TRANSACTION_HEADER = 'NewRelicTransaction'
const MATCH_CAT_TRANSACTION_HEADER = new RegExp(
  '^(?:' + HTTP_CAT_TRANSACTION_HEADER + '|' + MQ_CAT_TRANSACTION_HEADER + ')$',
  'i'
)
const HTTP_CAT_APP_DATA_HEADER = 'X-NewRelic-App-Data'
const MQ_CAT_APP_DATA_HEADER = 'NewRelicAppData'
const MATCH_CAT_APP_DATA_HEADER = new RegExp(
  '^(?:' + HTTP_CAT_APP_DATA_HEADER + '|' + MQ_CAT_APP_DATA_HEADER + ')$',
  'i'
)

/**
 * Decodes the CAT id and transaction headers from incoming request
 *
 * @param {object} headers incoming headers
 * @param id
 * @param transactionId
 * @param {string} encKey config.encoding_key used to decode CAT headers
 * @param {object} { externalId, externalTransaction }
 */
cat.parseCatData = function parseCatData(id, transactionId, encKey) {
  if (!encKey) {
    logger.warn('Missing encoding key, not extract CAT headers!')
    return {}
  }

  let externalId = null

  if (id) {
    externalId = hashes.deobfuscateNameUsingKey(id, encKey)
  }

  let externalTransaction = null
  if (transactionId) {
    try {
      externalTransaction = JSON.parse(hashes.deobfuscateNameUsingKey(transactionId, encKey))
    } catch (e) {
      logger.trace(`Got an unparsable CAT header ${HTTP_CAT_ID_HEADER} %s`, transactionId)
    }
  }

  return { externalId, externalTransaction }
}

/**
 * Adds the appropriate keys to transaction based on the incoming parsed CAT data
 *
 * @param {string} externalId decoded CAT id
 * @param {Array} externalTransaction CAT transaction
 * @param {Transaction} transaction active transaction
 */
cat.assignCatToTransaction = function assignCatToTransaction(
  externalId,
  externalTransaction,
  transaction
) {
  if (typeof externalId === 'string') {
    transaction.incomingCatId = externalId
  }

  if (Array.isArray(externalTransaction)) {
    const [referringGuid, , tripId, referringPathHash] = externalTransaction
    transaction.referringTransactionGuid = referringGuid

    if (typeof tripId === 'string') {
      transaction.tripId = tripId
    } else if (tripId) {
      transaction.invalidIncomingExternalTransaction = true
    }

    if (typeof referringPathHash === 'string') {
      transaction.referringPathHash = referringPathHash
    } else if (referringPathHash) {
      transaction.invalidIncomingExternalTransaction = true
    }
  }

  if (transaction.incomingCatId) {
    logger.trace(
      'Got inbound CAT headers in transaction %s from %s',
      transaction.id,
      transaction.incomingCatId
    )
  }
}

/**
 * Encodes the data to be set on the CAT app data header
 * for incoming requests
 *
 * @param {object} config agent config
 * @param {Transaction} transaction
 * @param {string} contentLength
 * @param {boolean} useMqHeaders flag to return proper headers for MQ compliance
 * @returns {object} { key, data} to add as header
 */
cat.encodeAppData = function encodeAppData(config, transaction, contentLength, useMqHeaders) {
  let appData = null
  const transactionName = transaction.getFullName() || ''

  try {
    appData = JSON.stringify([
      config.cross_process_id, // cross_process_id
      transactionName, // transaction name
      transaction.queueTime / 1000, // queue time (s)
      transaction.catResponseTime / 1000, // response time (s)
      contentLength, // content length (if content-length header is also being sent)
      transaction.id, // TransactionGuid
      false // force a transaction trace to be recorded
    ])
  } catch (err) {
    logger.trace(
      err,
      'Failed to serialize transaction: %s - not adding CAT response headers',
      transactionName
    )
    return
  }

  const encKey = config.encoding_key
  const obfAppData = hashes.obfuscateNameUsingKey(appData, encKey)
  const key = useMqHeaders ? MQ_CAT_APP_DATA_HEADER : HTTP_CAT_APP_DATA_HEADER
  return { key, data: obfAppData }
}

/**
 * Adds CAT headers to outbound request.
 *
 * @param {object} config agent config
 * @param {Transaction} transaction
 * @param {object} headers object that contains headers the agent is adding to client request
 * @param {boolean} useMqHeaders flag to return proper headers for MQ compliance
 */
cat.addCatHeaders = function addCatHeaders(config, transaction, headers, useMqHeaders) {
  if (!config.encoding_key) {
    logger.warn('Missing encoding key, not adding CAT headers!')
    return
  }

  const idHeader = useMqHeaders ? MQ_CAT_ID_HEADER : HTTP_CAT_ID_HEADER
  const transactionHeader = useMqHeaders ? MQ_CAT_TRANSACTION_HEADER : HTTP_CAT_TRANSACTION_HEADER

  // Add in the application ID
  if (config.obfuscatedId) {
    headers[idHeader] = config.obfuscatedId
  }

  const transactionName = transaction.getFullName() || ''

  const pathHash = hashes.calculatePathHash(
    config.applications()[0],
    transactionName,
    transaction.referringPathHash
  )
  transaction.pushPathHash(pathHash)

  try {
    const transactionData = hashes.obfuscateNameUsingKey(
      JSON.stringify([transaction.id, false, transaction.tripId || transaction.id, pathHash]),
      config.encoding_key
    )
    headers[transactionHeader] = transactionData

    logger.trace('Added outbound request CAT headers in transaction %s', transaction.id)
  } catch (err) {
    logger.trace(err, 'Failed to create CAT payload')
  }
}

/**
 * Find the CAT id, transaction, app data headers
 * from the headers of either HTTP or MQ request
 *
 * @param {object} headers
 * @returns {object} { id, transactionId, appData }
 */
cat.extractCatHeaders = function extractCatHeaders(headers) {
  // Hunt down the CAT headers.
  let id = null
  let transactionId = null
  let appData = null
  // eslint-disable-next-line guard-for-in
  for (const key in headers) {
    if (MATCH_CAT_ID_HEADER.test(key)) {
      id = headers[key]
    } else if (MATCH_CAT_TRANSACTION_HEADER.test(key)) {
      transactionId = headers[key]
    } else if (MATCH_CAT_APP_DATA_HEADER.test(key)) {
      appData = headers[key]
    }
    if (id && transactionId && appData) {
      break
    }
  }

  return { id, transactionId, appData }
}

/**
 * Extracts the account Id from CAT data and verifies if it is
 * a trusted account id
 *
 * @param {object} CAT data
 * @param data
 * @param {Array} trustedAccounts from config
 * @returns {boolean}
 */
cat.isTrustedAccountId = function isTrustedAccountId(data, trustedAccounts) {
  const accountId = parseInt(data.split('#')[0], 10)
  const trusted = trustedAccounts.includes(accountId)
  if (!trusted) {
    logger.trace('Response from untrusted CAT header account id: %s', accountId)
  }
  return trusted
}

/**
 * Decodes the CAT App Data header and extracts the downstream
 * CAT id, transaction id
 *
 * @param {object} config agent config
 * @param {string} obfAppData encoded app data to parse and use
 * @param {Array} decoded app data header
 */
cat.parseAppData = function parseAppData(config, obfAppData) {
  if (!config.encoding_key) {
    logger.trace('config.encoding_key is not set - not parsing response CAT headers')
    return
  }

  if (!config.trusted_account_ids) {
    logger.trace('config.trusted_account_ids is not set - not parsing response CAT headers')
    return
  }

  let appData = null
  try {
    appData = JSON.parse(hashes.deobfuscateNameUsingKey(obfAppData, config.encoding_key))
  } catch (e) {
    logger.warn(`Got an unparsable CAT header ${HTTP_CAT_APP_DATA_HEADER}: %s`, obfAppData)
    return
  }

  // Make sure it is a trusted account
  if (!cat.isTrustedAccountId(appData && appData[0], config.trusted_account_ids)) {
    return
  }

  return appData
}

/**
 * Assigns the CAT id, transaction to segment and adds `transaction_guid` when it exists.
 * It also renames the segment name based on the newly decoded app data when host is present
 *
 * @param {Array} appData decodes CAT app data
 * @param {TraceSegment} segment
 * @param {string} [host] if host is present it will rename segment with app data and host
 */
cat.assignCatToSegment = function assignCatToSegment(appData, segment, host) {
  if (!Array.isArray(appData) || typeof appData[0] !== 'string') {
    logger.trace(`Unknown format for CAT header ${HTTP_CAT_APP_DATA_HEADER}.`)
    return
  }

  segment.catId = appData[0]
  segment.catTransaction = appData[1]

  if (host) {
    segment.name = `${NAMES.EXTERNAL.TRANSACTION}${host}/${segment.catId}/${segment.catTransaction}`
  }

  let transactionGuid
  if (appData.length >= 6) {
    transactionGuid = appData[5]
    segment.addAttribute('transaction_guid', transactionGuid)
  }
  logger.trace(
    'Got inbound response CAT headers in transaction %s from %s',
    segment.transaction.id,
    transactionGuid
  )
}
