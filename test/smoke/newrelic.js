/**
 * New Relic agent configuration.
 *
 * See lib/config.defaults.js in the agent distribution for a more complete
 * description of configuration variables and their potential values.
 */
exports.config = {
  /**
   * Array of application names.
   */
  app_name: ['express smoke test'],
  /**
   * Your New Relic license key.
   */
  license_key: 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b',
  logging: {
    /**
     * Level at which to log. 'trace' is most useful to New Relic when diagnosing
     * issues with the agent, 'info' and higher will impose the least overhead on
     * production applications.
     */
    level: 'info'
  },
  host: 'staging-collector.newrelic.com'
}
