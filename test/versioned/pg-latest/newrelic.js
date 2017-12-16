'use strict'

exports.config = {
  app_name: ['pg@latest test'],
  license_key: 'license key here',
  utilization: {
    detect_aws: false,
    detect_pcf: false,
    detect_azure: false,
    detect_gcp: false,
    detect_docker: false
  },
  transaction_tracer: {
    record_sql: 'raw'
  },
  slow_sql: {
    enabled: true
  },
  logging: {
    level: 'trace',
  }
}
