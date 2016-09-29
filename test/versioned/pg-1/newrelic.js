exports.config = {
  app_name: ['pg@1 test'],
  license_key: 'license key here',
  utilization: {
    detect_aws: false,
    detect_docker: false
  },
  transaction_tracer: {
    record_sql: 'raw'
  },
  slow_sql: {
    enabled: true
  },
  logging: {
    enabled: false,
  }
}
