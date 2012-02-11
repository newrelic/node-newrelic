exports.config =
{    
	app_name: ['MyApplication'],
	host: 'collector.newrelic.com',
	port: 80,
	log_level: 'info',
	agent_enabled: true,
  
	error_collector: {
		enabled: true,
		ignore_status_codes: [404]
	},
      
	transaction_tracer: {
		enabled: true,
        trace_threshold: 'apdex_f'
	}
};