/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const gcpMetadata = require('gcp-metadata')
const logger = require('../logger.js').child({ component: 'gcp-info' })
let resultDict = null

module.exports = fetchGCPInfo
module.exports.clearCache = function clearGCPCache() {
  resultDict = null
}

async function fetchGCPInfo(agent, callback) {
  if (!agent.config.utilization || !agent.config.utilization.detect_gcp) {
    logger.trace({ utilization: 'gcp' }, 'Skipping GCP due to being disabled via config.')
    return setImmediate(callback, null)
  }

  if (resultDict) {
    logger.trace({ utilization: 'gcp' }, 'Returning previously found results.')
    return setImmediate(callback, null, resultDict)
  }

  const isAvail = gcpMetadata.isAvailable()
  if (!(await isAvail)) {
    logger.debug({ utilization: 'gcp' }, 'GCP metadata is not available.')
    return callback(err)
  }

  // Grab relevant metadata
  const attributes = ['id', 'machineType', 'name', 'zone']
  const values = await Promise.all(attributes.map(attr => getMetadataAttribute(isAvail, attr)))
  const [id, machineType, name, zone] = values

  const results = {
    id,
    name,
    machineType: machineType ? machineType.substring(machineType.lastIndexOf('/') + 1) : undefined,
    zone: zone ? zone.substring(zone.lastIndexOf('/') + 1) : undefined
  }

  resultDict = results
  callback(null, results)
}

/**
 * Get the metadata attribute from gcp-metadata
 * @param {*} isAvail gcpMetadata.isAvailable()
 * @param {*} attribute The attribute to get from the metadata e.g. id
 * @returns The value of the attribute or null if not available
 */
async function getMetadataAttribute(isAvail, attribute) {
  if (!(await isAvail)) {
    logger.debug({ utilization: 'gcp' }, 'GCP metadata is not available.')
    return undefined
  }
  try {
    const value = await gcpMetadata.instance(attribute)
    return value.toString()
  } catch (e) {
    logger.debug({ utilization: 'gcp', error: e }, `Failed to get GCP attribute '${attribute}'.`)
    return undefined
  }
}