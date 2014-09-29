exports.config = {
  app_name           : ['My Application'],
  license_key        : 'license key here',
  logging            : {
    level : 'trace',
    filepath : '../../newrelic_agent.log'
  },
  transaction_tracer : {
    enabled : true
  }
};
