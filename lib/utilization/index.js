'use strict'

var logger = require('../logger').child({component: 'utilization'})

var VENDOR_METHODS = {
  aws: require('./aws-info'),
  pcf: require('./pcf-info'),
  azure: require('./azure-info'),
  gcp: require('./gcp-info'),
  docker: require('./docker-info').getVendorInfo
}
var VENDOR_NAMES = Object.keys(VENDOR_METHODS)

module.exports.getVendors = getVendors
function getVendors(agent, callback) {
  var done = 0
  var vendors = null
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
