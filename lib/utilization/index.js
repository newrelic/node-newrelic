/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger').child({ component: 'utilization' })

const VENDOR_METHODS = {
  aws: require('./aws-info'),
  pcf: require('./pcf-info'),
  azure: require('./azure-info'),
  gcp: require('./gcp-info'),
  docker: require('./docker-info').getVendorInfo,
  kubernetes: require('./kubernetes-info')
}
const VENDOR_NAMES = Object.keys(VENDOR_METHODS)

module.exports.getVendors = getVendors
function getVendors(agent, callback) {
  let done = 0
  let vendors = null
  VENDOR_NAMES.forEach(function getVendorInfo(vendor) {
    VENDOR_METHODS[vendor](agent, function getInfo(err, result) {
      logger.trace('Vendor %s finished.', vendor)
      if (result) {
        vendors = vendors || Object.create(null)
        vendors[vendor] = result
      }

      if (++done === VENDOR_NAMES.length) {
        callback(null, vendors)
      }
    })
  })
}
