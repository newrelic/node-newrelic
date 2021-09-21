/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const cat = module.exports
const hashes = require('./hashes')
const logger = require('../logger').child({ component: 'cat' })

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
 * Parses and decodes the CAT headers from incoming request and adds information to the active
 * transaction
 *
 * @param {Object} headers incoming headers
 * @param {string} encKey config.encoding_key used to decode CAT headers
 * @param {Transaction} tx
 */
cat.handleCatHeaders = function handleCatHeaders(headers, encKey, tx) {
  if (!encKey) {
    logger.warn('Missing encoding key, not extract CAT headers!')
    return
  }

  const { id, transactionId } = cat.extractCatHeaders(headers)

  let parsedCatId = null
  if (id) {
    parsedCatId = hashes.deobfuscateNameUsingKey(id, encKey)
  }

  let externalTrans = null
  if (transactionId) {
    try {
      externalTrans = JSON.parse(hashes.deobfuscateNameUsingKey(transactionId, encKey))
    } catch (e) {
      logger.trace(`Got an unparsable CAT header ${HTTP_CAT_ID_HEADER} %s`, transactionId)
    }
  }

  cat.parsedHeadersToTx(parsedCatId, externalTrans, tx)

  if (tx.incomingCatId) {
    logger.trace('Got inbound CAT headers in transaction %s from %s', tx.id, tx.incomingCatId)
  }
}

/**
 * Checks if hash is string
 *
 * @param {*} hash
 * @return {Boolean}
 */
function _isValidReferringHash(hash) {
  return typeof hash === 'string'
}

/**
 * Adds the appropriate keys to transaction based on the incoming parsed CAT data
 *
 * @param {string} parsedCatId decoded CAT id
 * @param {Array} externalTrans CAT transaction
 * @param {Transaction} tx active transaction
 */
cat.parsedHeadersToTx = function parsedHeadersToTx(parsedCatId, externalTrans, tx) {
  if (typeof parsedCatId === 'string') {
    tx.incomingCatId = parsedCatId
  }

  if (Array.isArray(externalTrans)) {
    tx.referringTransactionGuid = externalTrans[0]
    if (typeof externalTrans[2] === 'string') {
      tx.tripId = externalTrans[2]
    } else if (externalTrans[2]) {
      tx.invalidIncomingExternalTransaction = true
    }

    if (_isValidReferringHash(externalTrans[3])) {
      tx.referringPathHash = externalTrans[3]
    } else if (externalTrans[3]) {
      tx.invalidIncomingExternalTransaction = true
    }
  }
}

/**
 * Encodes the data to be set on the header CAT AppData header
 * for incoming requests
 *
 * @param {Object} config agent config
 * @param {Transaction} tx
 * @param {string} contentLength
 * @return {Object} { key, data} to add as header
 */
cat.encodeAppData = function encodeAppData(config, tx, contentLength) {
  let appData = null
  const txName = tx.getFullName() || ''

  try {
    appData = JSON.stringify([
      config.cross_process_id, // cross_process_id
      txName, // transaction name
      tx.queueTime / 1000, // queue time (s)
      tx.catResponseTime / 1000, // response time (s)
      contentLength, // content length (if content-length header is also being sent)
      tx.id, // TransactionGuid
      false // force a transaction trace to be recorded
    ])
  } catch (err) {
    logger.trace(
      err,
      'Failed to serialize transaction: %s - not adding CAT response headers',
      txName
    )
    return
  }

  const encKey = config.encoding_key
  const obfAppData = hashes.obfuscateNameUsingKey(appData, encKey)
  return { key: HTTP_CAT_APP_DATA_HEADER, data: obfAppData }
}

/**
 * Adds CAT headers to outbound request.
 *
 * @param {Object} config agent config
 * @param {Transaction} tx
 * @param {Object} headers object that contains headers the agent is adding to client request
 */
cat.addCatHeaders = function addCatHeaders(config, tx, headers, useMqHeaders) {
  if (!config.encoding_key) {
    logger.warn('Missing encoding key, not adding CAT headers!')
    return
  }

  const idHeader = useMqHeaders ? MQ_CAT_ID_HEADER : HTTP_CAT_ID_HEADER
  const txHeader = useMqHeaders ? MQ_CAT_TRANSACTION_HEADER : HTTP_CAT_TRANSACTION_HEADER

  // Add in the application ID
  if (config.obfuscatedId) {
    headers[idHeader] = config.obfuscatedId
  }

  const txName = tx.getFullName() || ''

  const pathHash = hashes.calculatePathHash(config.applications()[0], txName, tx.referringPathHash)
  tx.pushPathHash(pathHash)

  try {
    const txData = hashes.obfuscateNameUsingKey(
      JSON.stringify([tx.id, false, tx.tripId || tx.id, pathHash]),
      config.encoding_key
    )
    headers[txHeader] = txData

    logger.trace('Added outbound request CAT headers in transaction %s', tx.id)
  } catch (err) {
    logger.trace(err, 'Failed to create CAT payload')
  }
}

/**
 * Find the CAT id, transaction, app data headers
 * from the headers of either HTTP or MQ request
 *
 * @param {Object} headers
 * @return {Object} { id, transactionId, appData }
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
 * @param {Object} CAT data
 * @param {Array} trustedAccounts from config
 * @return {Boolean}
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
 * CAT id, transaction id and adds to the active segment
 *
 * @param {Object} config agent config
 * @param {TraceSegment} segment to attach the CAT data to
 * @param {string} obfAppData encoded app data to parse and use
 *
 */
cat.pullCatHeaders = function pullCatHeaders(config, segment, obfAppData) {
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
  if (!appData.length || typeof appData[0] !== 'string') {
    logger.trace(`Unknown format for CAT header ${HTTP_CAT_APP_DATA_HEADER}.`)
  }

  if (!cat.isTrustedAccountId(appData[0], config.trusted_account_ids)) {
    return
  }

  // It's good! Pull out the data we care about
  segment.catId = appData[0]
  segment.catTransaction = appData[1]
  if (appData.length >= 6) {
    segment.addAttribute('transaction_guid', appData[5])
  }
  logger.trace(
    'Got inbound response CAT headers in transaction %s from %s',
    segment.transaction.id,
    appData[5]
  )
}
