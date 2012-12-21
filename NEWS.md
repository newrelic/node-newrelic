### v0.9.11-88 / beta-11 (2012-12-20):

* When server-side configuration changes, the agent will now correctly
  restart when told to do so by New Relic's servers.
* Correctly wrap net.Server.prototype.listen -- wasn't returning the
  server object, which broke some apps.
* If you're on a SmartOS VM with a 64-bit base image and a 64-bit build of
  node that's v0.8.5 or earlier, the agent will no longer cause node to
  crash. Don't even ask.

### v0.9.10-85 / beta-10 (2012-12-13):

* Squared up the environment variable names with existing practice,
  especially with an eye towards conformity with Heroku documentation.
* Flushed out all configuration used anywhere in the agent and made sure
  it was documented in config.default.js.
* Using the new environment setting NEW_RELIC_NO_CONFIG_FILE, override the
  need to have a settings file at all.
* Add the ability to send log output to stdout or stderr.

### v0.9.9-82 / beta-09 (2012-12-12):

* Can now configure the agent via environment variables. See README.md for
  details.
* Can now configure the location of the agent log via either logging.filepath
  in the configuration file, or NR_LOGGING_FILEPATH in the app's environment.
* Turning off the error tracer via configuration now actually disables it.

### v0.9.7-75 / beta-08 (2012-12-06):

* Express view rendering was being instrumented improperly before, causing
  rendering to fail and Express to hang. Both Express 2 and 3 were affected,
  and both have been fixed.
* When NODE_PATH is set, resolve NODE_PATH elements properly so that package
  lookup for environmental information gathering doesn't crash the app.
* Now send the Node version along with the rest of the environment data.

### v0.9.6-70 / beta-07 (2012-11-30):

* Added first cut at support for error tracing via Node.js 0.8+ domains.
  Versions of Node.js that support it (v0.8.9 and above) will make a
  best-faith effort to clean up after errors.
* Improved non-domain error handling on outbound HTTP requests.
* Dramatically improved accuracy of HTTP request timing.

### v0.9.5-63 / beta-06 (2012-11-28):

* Be more careful in dealing with HTTP requests.

### v0.9.4-61 / beta-05 (2012-11-26):

* Further improvements to node-mongodb-native instrumentation.
* Package now available via npm as "newrelic".

### v0.9.3-57 / beta-04 (2012-11-06):

* Send a list of the packages and dependencies available to an app on
  connection to New Relic servers.
* Generally cleaned up submission of configuration information.
* Added trace-level logging of instrumentation to help diagnose issues
  with transaction tracing.
* Fixes to web error transaction reporting.

### v0.9.2-53 / beta-03 (2012-11-02):

* Added support for node-mysql 2.0.0a driver series.
* Added support for Express 3.
* Added rudimentary instrumentation for node-redis.
* Added rudimentary support for generic-pool (for use with MySQL).
* Fixed view instrumentation for Express.
* Improved coverage of MongoDB driver.
* Many small fixes to make logging more robust.
* Don't return a partially initialized agent -- shut agent down
  gracefully if startup fails.

### v0.9.1-46 / beta-02 (2012-10-01):

* Fixed an issue in how transaction traces were serialized that kept them from
  being displayed within RPM.
* Added request parameters to transaction traces, as well as URL normalization.
* Reconciled segment names in transaction traces with the corresponding
  metric names.
* Changed the logging module to bunyan. This means that logs are now stored
  as JSON. If you want pretty-printed logs, `npm install -g bunyan` and then
  use the bunyan CLI tool to format and filter the logs.
* The agent now sets the logging level to the configured level. Logs sent to
  New Relic should have been captured at the 'trace' level for the duration
  of the beta.
* Fixed metric -> ID renaming semantics.
* Verified that agent works with Node 0.8's cluster module.

### v0.9.0-39 / beta-01 (2012-09-28):

* Completely new transaction tracer. Faster, simpler and vastly more
  deterministic, but the reworking likely introduced a bunch of new bugs. This
  also means that the agent no longer directly affects the call stack or
  overrides any of the core event-handling methods, which means the overhead
  of the transaction tracer is vastly reduced. Which is good, because you
  still can't turn it off.
* Transaction traces should now report the correct caller-callee relationships.
* Transaction tracer is now internally instrumented, for better debugging.
* Added support for Restify.
* Using the Node.js agent in Restify app no longer causes them to crash
  (fixes NA-47).
* Improved support for Express (NA-8).
* Lots of fixes to the MongoDB, MySQL and memcached instrumentation.
* MongoDB instrumentation no longer crashes MongoDB apps that include
  the agent (NA-48).
* More testing in Node.js 0.6.x (hard to completely test, as node-tap isn't
  that friendly to Node < 0.6.21).

### v0.8.5-34 / alpha-06 (2012-09-24):

* Transaction trace durations are now reported properly (were seconds, now
  milliseconds).
* The agent no longer causes Restify applications to crash.
* The internal Node metrics sampler now shuts itself down properly.

### v0.8.4-30 / alpha-05 (2012-09-20):

* Improved timing of Express / Connect request handlers.

### v0.8.3-28 / alpha-04 (2012-09-19):

* Added support for internal supportability metrics (enabled via setting
  debug.internal_metrics to true in newrelic.js).

### v0.8.2-26 / alpha-03 (2012-09-14):

* By popular demand, support for Node 0.6.x. Tested against versions
  0.6.5 and 0.6.19.

### v0.8.1-25 / alpha-02 (2012-09-14):

* Transaction traces no longer crash the RPM transaction trace viewer.
* The Node.js agent now follows the rules for Top N slow trace gathering.
* Compress large requests before submitting them to the New Relic
  collector.
* trace_threshold can now be configured from the server, and is not
  hard coded to apdex_f.
* The agent definitely doesn't work (for now) in Node 0.6.x and earlier.
  The agent will now notify developers (on the console) that it's refusing
  to start up under old versions, but won't crash the app.
* Don't crash the instrumented app if config is missing.

### v0.8.0-21 / alpha-01 (2012-09-11);

* The agent faithfully records and reports basic metrics.
* The agent reports error metrics.
* The agent gathers basic slow transaction trace data.
* The agent reports transaction trace data.
