'use strict'

module.exports.getVendors = getVendors
function getVendors(agent, callback) {
  var vendorMethods = {
    aws: require('./aws-info'),
    pcf: require('./pcf-info'),
    azure: require('./azure-info'),
    gcp: require('./gcp-info'),
    docker: require('./docker-info').getVendorInfo
  }

  var done = 0
  var vendors = null
  var vendorNames = Object.keys(vendorMethods)
  vendorNames.forEach(function getVendorInfo(vendor) {
    vendorMethods[vendor](agent, function getInfo(err, result) {
      if (result) {
        vendors = vendors || {}
        vendors[vendor] = result
      }

      if (++done === vendorNames.length) {
        callback(null, vendors)
      }
    })
  })
}
