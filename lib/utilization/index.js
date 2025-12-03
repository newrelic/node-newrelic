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

  for (const [vendor, fn] of Object.entries(vendorDataFuncs)) {
    logger.trace({ utilization: vendor }, 'Detecting utilization info for vendor %s.', vendor)
    try {
      const result = await new Promise((resolve, reject) => {
        fn(agent, (error, data) => {
          if (error) return reject(error)
          resolve(data)
        })
      })

      if (result == null) {
        logger.trace({ utilization: vendor }, 'No information returned for vendor %s.', vendor)
        continue
      }

      vendors = vendors || Object.create(null)
      vendors[vendor] = result
      logger.info({ utilization: vendor, result }, 'Information for vendor %s retrieved successfully.', vendor)
    } catch (error) {
      logger.error({ utilization: vendor, error }, 'Failed to get information about vendor %s.', vendor)
    } finally {
      logger.trace({ utilization: vendor }, 'Vendor %s finished.', vendor)
    }
  }

  return vendors
}
