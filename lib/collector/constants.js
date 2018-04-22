'use strict'

module.exports.ERRORS = {
  INVALID_LICENSE: 'NewRelic::Agent::LicenseException',
  LIMIT_EXCEEDED: 'NewRelic::Agent::InternalLimitExceeded',
  RESTART: 'NewRelic::Agent::ForceRestartException',
  DISCONNECT: 'NewRelic::Agent::ForceDisconnectException',
  MAINTENANCE: 'NewRelic::Agent::MaintenanceError',
  RUNTIME: 'RuntimeError'
}
