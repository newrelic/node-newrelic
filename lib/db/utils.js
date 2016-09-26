'use strict'

var urltils = require('../util/urltils')

var INSTANCE_UNKNOWN = 'unknown'


exports.captureInstanceAttributes = captureInstanceAttributes
function captureInstanceAttributes(segment, host, port/* , database */) {
  port = port || INSTANCE_UNKNOWN
  if (host && urltils.isLocalhost(host)) {
    host = segment.transaction.agent.config.getHostnameSafe(host)
  }
  if (!host || host === 'UNKNOWN_BOX') { // Config's default name of a host.
    host = INSTANCE_UNKNOWN
  }

  // XXX: Uncomment this when metric names have been decided on
  // segment.parameters.database_name = database || INSTANCE_UNKNOWN
  // segment.parameters.instance = host + ':{' + port + '}'
}
