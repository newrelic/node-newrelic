exports.config = {
  app_name           : ['My Application'],
  license_key        : 'license key here',
  logging            : {
    level : 'debug',
    filepath : '../../../newrelic_agent.log'
  },
  utilization: {
    detect_aws: false,
    detect_pcf: false,
    detect_azure: false,
    detect_gcp: false,
    detect_docker: false
  },
  slow_sql: {
    enabled: true,
  },
  transaction_tracer : {
    record_sql: 'raw',
    explain_threshold: 0,
    enabled : true
  }
}
