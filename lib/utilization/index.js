/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const defaultLogger = require('../logger').child({ component: 'utilization' })

const VENDOR_METHODS = {
  aws: require('./aws-info'),
  azure: require('./azure-info'),
  azurefunction: require('./azurefunction-info'),
  docker: require('./docker-info').getVendorInfo,
  ecs: require('./ecs-info'),
  gcp: require('./gcp-info'),
  kubernetes: require('./kubernetes-info'),
  pcf: require('./pcf-info')
}

module.exports.getVendors = async function getVendors(
  agent,
  {
    logger = defaultLogger,
    vendorDataFuncs = VENDOR_METHODS
  } = {}
) {
  let vendors = null
  const toResolve = []

  for (const [vendor, resolver] of Object.entries(vendorDataFuncs)) {
    const promise = resolveVendor({ vendor, resolver, agent, logger })
    toResolve.push(promise)
  }

  const results = await Promise.all(toResolve)
  for (const [vendor, result] of results) {
    if (!vendor) continue
    vendors = vendors || Object(null)
    vendors[vendor] = result
  }

  return vendors
}

async function resolveVendor({ vendor, resolver, agent, logger }) {
  logger.trace({ utilization: vendor }, 'Detecting utilization info for vendor %s.', vendor)
  try {
    const result = await new Promise((resolve, reject) => {
      resolver(agent, (error, data) => {
        if (error) return reject(error)
        resolve(data)
      })
    })

    if (result == null) {
      logger.trace({ utilization: vendor }, 'No information returned for vendor %s.', vendor)
      return []
    }

    logger.info({ utilization: vendor, result }, 'Information for vendor %s retrieved successfully.', vendor)
    return [vendor, result]
  } catch (error) {
    logger.error({ utilization: vendor, error }, 'Failed to get information about vendor %s.', vendor)
    return []
  } finally {
    logger.trace({ utilization: vendor }, 'Vendor %s finished.', vendor)
  }
}
