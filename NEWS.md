### v1.14.5 (2014-12-30):

* Errors that occur in background transactions now have custom parameters copied
  onto them in the same manner as web transactions.

* Memcached instrumentation updated to account for additional arguments that
  might be passed to the command function that the agent wraps.

### v1.14.4 (2014-12-22):

* Custom web transactions can have their names changed by `nr.setTransactionName()`.
  Thanks to [Matt Lavin](https://github.com/mdlavin) for this patch!

* Fixed a bug where Express instrumentation could crash if transaction state was
  lost in a sub router.

### v1.14.3 (2014-12-18):

* Improved the Express instrumentation to be more defensive before doing
  property lookups, fixing a crash that could happen in an exceptional state.

* Improved logging when the New Relic agent cannot connect to New Relic servers.

* Make Cross Application Tracer header injection less aggressive fixing
  interaction with other libraries such as riak-js.

### v1.14.2 (2014-12-11):

* Added support for Hapi v8.

* [briandela](https://github.com/briandela) contributed a fix for an crash that
  would occur when using hapi with vhosts.

### v1.14.1 (2014-12-05):

* Fixed a bug that caused some outbound http requests to show up in the
  New Relic UI as requests to `localhost` rather than the specified domain.

* The agent no longer reports errors from outbound http requests if they were
  handled by the user's application

### v1.14.0 (2014-11-25):

* The node agent now instruments connections to Oracle Databases using the
  `oracle` driver. This patch was contributed by
  [ryanwilliamquinn](https://github.com/ryanwilliamquinn)

* Fixed an issue that would break kraken apps when the node agent was enabled.
  This patch was contributed by [Lenny Markus](https://github.com/lmarkus)

### v1.13.4 (2014-11-20):

* Added support for the the aggregate method on mongodb collections. This patch
  was contributed by [taxilian](https://github.com/taxilian)

### v1.13.3 (2014-11-13):

* Fixed a bug in Cross Application Tracing where the agent would sometimes
  attempt to set a header after headers had already been sent.

* Replaced the logger with one that is handles file writes properly lowering
  overall resource usage.

  This is a small change with a large impact. `fs.createWriteStream` returns
  whether data was queued or not. If it is queued it is recommended to wait on a
  `drain` event but this isn't manditory. Most loggers we've found ignore this
  event which leads to many writes getting buffered and a rapid increase in
  native heap size as well as lowering the process's ability to respond to
  requests.

### v1.13.2 (2014-11-06):

* Updated support for hapi 7.2 and higher.

  Hapi refactored how the server is instantiated and caused the agent to not be
  able to get transaction names. This release accounts for the update and
  enables full instrumentation.

### v1.13.1 (2014-11-06):

* This release was unpublished as it got packaged incorrectly.

### v1.13.0 (2014-10-31):

* Added support for Custom Metrics

  Custom metrics provides a way to send additional metrics up to New Relic APM,
  which can be viewed with Custom Dashboards. We have two APIs for this,
  recordMetric(name, value) and incrementMetric(name[, value]). Read more about
  this in our docs:
  https://docs.newrelic.com/docs/agents/nodejs-agent/supported-features/nodejs-custom-metrics

* Fixed a bug in deeply nested transactions.

  Previously we allowed transactions to be nested to any depth. We've found in
  some cases this causes stack depth problems and are now limiting to 900
  segments per transaction. We will still collect metrics on all segments, but
  transaction traces will only show the first 900.

* Fixed a bug where custom tracers would show 0 time if the transaction ended n
  them.

  This may change the times you see for other types of tracers by a small
  amount. The change will reflect slightly more accurate timing.

### v1.12.2 (2014-10-23):

* Fixed a bug that would cause the application to crash on outbound connections
  when using node 0.8.

* Fixed a bug that could sometimes cause the application to crash while parsing
  MySQL queries.

### v1.12.1 (2014-10-16):

* Added support for Label Categories

  The agent now supports setting Labels for your application on a per instance
  level, using either an environment variable, or a config file setting.
  https://docs.newrelic.com/docs/apm/new-relic-apm/maintenance/categories-rollups-organizing-your-apps-servers

* Improved transaction names for express 4

  express 4 added the ability to mount apps and routers at specific urls.  The
  node agent would previously use only the portion of the route that was the
  last router or app matched as the transaction name.  Transaction names will
  now include the entire matched route.

* Added detection for uninstrumented instances of modules that should be instrumented

  The agent will now detect if an application has required a module before
  `require('newrelic')` .If this occurs, the agent will add a warning in the
  log file and display a warning banner in the UI.

* Added more logging to custom instrumentation APIs at `debug` level.

  The logging was improved for the benefit of people using the following
  APIs: `createTracer`, `createWebTransaction`, `createBackgroundTransaction`,
  and `endTransaction`. It will log when transactions are created and when
  transactions are ended. It will also log when it can't create a tracer due
  to there being no active transaction.

* Fixed a bug in QL instrumentation where the event emitter from
  `query`   could not chain `.on` calls. This patch was contributed by
  [sebastianhoitz](https://github.com/sebastianhoitz).

* Fixed a bug in `createBackgroundTransaction` where if the agent was disabled
  it didn't take a `group` argument. This patch was contributed by [nullvariable](https://github.com/nullvariable).

* Fixed a bug in our URL parsing where in Node v0.11.14 `url.parse` returns a
  differently shaped object than expected. This patch was contributed by
  [atomantic](https://github.com/atomantic)

  **Note**: Node v0.11.x is not officially supported, but Node v0.12 will be and
  this patch helps us get ready for that.

### v1.12.0 (2014-10-10):

* Added support for Cross Application Tracing

  The agent now supports Cross Application Tracing, which allows the New Relic
  APM UI to display traces that span multiple applications.
  https://docs.newrelic.com/docs/apm/traces/cross-application-traces/cross-application-traces

* Fixed a bug that would cause application to crash on request when using the
  kraken framework.

* Loosened the restrictions on the `app_name` setting. Application names may now
  include any Unicode characters.

### v1.11.5 (2014-10-06):

* Fixed a type error while checking the payload size to be sent to the New Relic
  servers.

  When this happened the agent would fail to send the payload to New Relic. This
  was more likely to occur in higher throughput applications.

### v1.11.4 (2014-10-03):

* Fixed a bug where mutibyte characters would cause an error when sending data
  to the New Relic servers.

### v1.11.3 (2014-09-26):

* Updated hapi instrumentation to support the recently released v6.9.

* Fixed a bug where an invalid package.json could cause the agent to crash while
  it recursed through `node_modules` gathering version details.

* Properly name `other` SQL queries.

  Previously when the agent failed to parse SQL it would create a metric stating
  the database type, query type, and query table were all unknown. This has been
  changed to keep track of database type and create an appropriate `other`
  operation metric like other agents.

### v1.11.2 (2014-09-19):

* Custom Instrumentation functions now pass through the return value of their
  passed in callback.

* Multiple improvements to PostgreSQL instrumentation

  When no callback was detected in the query functions, we were inserting our
  own. The insertion itself caused a crash. Adding a callback also modified the
  behavior of the pg module. Instead, we now listen for `error` or `end` events
  to finish segments.

  We now generate metrics for statement type/table combinations. Look for these
  in the database tab your APM Account!

### v1.11.1 (2014-09-11):

* Improved MongoDB find instrumentation.

  The `mongo` driver provides many different ways to invoke its API and find
  documents. In previous releases, some API invocations would create transaction
  trace segments that would not end properly, leading to inaccurately large
  segment times. This release now covers all the ways to find and iterate
  through documents, ensuring segment times are accurate.

### v1.11.0 (2014-09-05):

* We now support PostgreSQL via the `pg` driver.

  The Node.js agent now records the amount of time spent in transactions with
  PostgreSQL databases. This timing can be viewed in the Transactions dashboard
  within individual transactions and their traces.

  The agent supports all of the following `pg` usage scenarios:
    * Using the pure javascript API exposed directly from `pg`
    * Using the "native" API exposed from `pg.native`
    * Using the "native" API exposed directly from `pg` when the
      `NODE_PG_FORCE_NATIVE` environment variable is set
    * Using the pure javascript API from the `pg.js` module

### v1.10.3 (2014-08-28):

* Removed a preemptive DNS lookup of the New Relic servers that could cause
  errors when behind a proxy.

### v1.10.2 (2014-08-25):

* Fix to prevent proxy credentials transmission

  This update prevents proxy credentials set in the agent config file from
  being transmitted to New Relic.

### v1.10.1 (2014-08-22):

* MySQL Pooling Support

  Better support for mysql pooling, including connections that use
  `createPoolCluster` and `createPool`. Previously connections obtained through
  a pool could potentially be uninstrumented.

### v1.10.0 (2014-08-15):

* Custom instrumentation

  The agent now supports the ability to annotate application code to provide
  customized instrumentation. This includes the ability to time both web and
  background transactions, and add tracers to measure activity within
  transactions like querying a database. Documentation available at
  https://docs.newrelic.com/docs/agents/nodejs-agent/supported-features/nodejs-custom-instrumentation

### v1.9.2 (2014-08-08):

* Fixed a bug in the express instrumentation where if you named an error handler
  function `handle` it would cause a recursion depth error.

### v1.9.1 (2014-07-30):

* Added a check for invalid characters in the `app_name` setting.

  The agent will now emit a warning and disable itself if any application name
  is invalid. Allowed characters are alphanumerics and certain punctuation
  characters ([](){}.?!')

* Router queue time now properly handles floating point values.

* Fixed a bug where a socket connection could throw a synchronous error and
  cause the application to crash.


### v1.9.0 (2014-07-24):

* We now support Cassandra via the `node-cassandra-cql` driver.

  New database instrumentation means that we can present you with the timing
  data for how long those queries take. Thanks to Aaron Silvas from GoDaddy for
  the initial implementation of the Cassandra instrumentation.

* Router queue time now supports `t=<number>` in the X-REQUEST-START and
  X-QUEUE-START headers.


### v1.8.1 (2014-07-18):

* Agent now tracks metrics for router queue time.
  In addition to X-REQUEST-START, the agent now supports X-QUEUE-START header times.
  This metric will show up as "Request Queueing" in the Overview tab.

### v1.8.0 (2014-07-11):

* General release of proxy support for the agent to connect to New Relic.
  * HTTP/HTTPS support from the `newrelic` module to the proxy
  * HTTP/HTTPS support from the `newrelic` module to New Relic.
  * Basic proxy authentication.
  * Allow custom certificates during TLS negotiation.
  * For more information, read our docs [here](https://docs.newrelic.com/docs/nodejs/customizing-your-nodejs-config-file#proxy)
* Fix for enabling High Security Mode via an environment variable
* Optimization to allow early garbage collection of TLS slab buffers.

### v1.7.5 (2014-07-02):

* Plain `http` routes (i.e. routes outside of a framework) now apply config
  naming rules early. See [rules for naming and ignoring requests](https://github.com/newrelic/node-newrelic#rules-for-naming-and-ignoring-requests).

  This fixes a bug where generating the *Browser Timing Header* would not work
  without a framework (i.e. express, restify, hapi).

* *Beta* support for connecting to newrelic via ssl through a proxy.
  See [issue 128](https://github.com/newrelic/node-newrelic/issues/128) for details.

### v1.7.4 (2014-06-26):

* The agent now reports the value of the `NODE_ENV` environment variable
  to New Relic.

### v1.7.3 (2014-06-20):

* Support for instrumenting a standalone express 4 router.
  See [issue 154](https://github.com/newrelic/node-newrelic/pull/154).
* Set the default log level to `info`.

### v1.7.2 (2014-06-13):

* Captured parameters for express, restify, and hapi have been normalized.

  When `capture_params` is enabled the agent will collect route and query
  parameters. Previously express and restify only captured route params, and
  hapi only captured query params. This normalizes the behavior across the
  frameworks.

* Fixed an issue with restify instrumentation that caused the agent to always
  collect route parameters.

  Users of restify who want to continue capturing route (and now query)
  parameters are advised to enable `capture_params`.

* Fixed an issue where circular configs caused the agent to crash.

### v1.7.1 (2014-06-05):

* Fixed an issue where collected errors did not include captured and custom
  parameters.

* Added the environment variable `NEW_RELIC_HIGH_SECURITY`. This correlates to
  the `high_security` setting in your `newrelic.js` for High Security Mode.


### v1.7.0 (2014-05-29):
* Client side setting of `high_security` is now supported.

  High Security Mode is a feature to prevent any sensitive data from being sent
  to New Relic. The local setting for the agent must match the server setting in
  the New Relic APM UI. If there is a mismatch, the agent will log a message and
  act as if it is disabled. A link to the docs for High Security Mode can be
  found [here](https://docs.newrelic.com/docs/subscriptions/security#high-security)

  Attributes of high security mode (when enabled):
    * requires ssl
    * does not allow capturing of parameters,
    * does not allow custom parameters

  The default setting for High Security Mode is ‘false’.

  Note: If you currently have high security mode enabled within the New Relic
  APM UI, you have to add `high_security: true` to your local newrelic.js.

* Fixed a bug in our instrumentation of restify, where if you were using the
  restify client with express as a web server, req.query would be overridden.

### v1.6.0 (2014-05-22):

* New Relic Insights support no longer requires a feature flag. If you are a
  paying customer, you'll begin to see data show up in Insights as soon as you
  upgrade to 1.6.0. The agent will send event data for every transaction up to
  10,000 per minute. After that events are statistically sampled. Event data
  includes transaction timing, transaction name, and any custom parameters. You
  can read what is sent in more detail
  [here](http://docs.newrelic.com/docs/insights/basic-attributes#transaction-defaults).

  You can read more about Insights [here](http://newrelic.com/insights).
  Documentation for configuring this feature can be found
  [here](https://docs.newrelic.com/docs/nodejs/customizing-your-nodejs-config-file#tx_events).

### v1.5.5 (2014-05-15):

* Fix a bug where if the user disabled the error collector, error count would
  be carried over harvest cycles instead of reset. This would result in an ever
  increasing error count until the app was restarted.

* New Relic Insights beta support. This is a feature for our paying customers.
  The support of Insights in the agent is beta, this means we don't recommend
  turning the feature on in production, but instead trying it out in development
  and staging environments.

  To enable Insights support add the following to your `newrelic.js`:

  ```
  feature_flag : {
    insights: true
  }
  ```

### v1.5.4 (2014-05-08):

* On connect, the full `newrelic` module configuration is pushed to
  New Relic APM. Full config will be visible under the
  *Agent initialization* tab, under the *Settings* button in
  the APM application page.

  The reported settings will reflect the *running* agent config,
  which may differ from the `newrelic.js` file depending on server-side,
  and environmental configuration.

### v1.5.3 (2014-05-01):

* Express 4 support.

  Closes [#132](https://github.com/newrelic/node-newrelic/issues/132).
  Express 4 apps now have their transactions named correctly.
  Errors in the middleware chain are properly recorded.

### v1.5.2 (2014-04-24):

* Fix [issue #118](https://github.com/newrelic/node-newrelic/issues/118)
  where dangling symbolic links in the `node_modules` folder
  would crash the environment scraper.

### v1.5.1 (2014-04-18):

* Upgrade continuation-local-storage dependency to 3.0.0.
  The `newrelic` node module uses `cls` to help join asynchronous transaction
  segments. The latest `cls` module includes a fix that prevents contexts from
  leaking across transactions.

### v1.5.0 (2014-04-11):

* Add high-security compliance for accounts with enterprise security enabled.
  By default, the agent now works with high-security accounts,
  whereas previously agents would receive an `Access Violation`.
* Add a `.addCustomParameter(name, value)` api call for adding custom parameters
  to transaction traces, and extend the `.noticeError(error, customParameters)`
  for adding additional parameters to error traces.
* Documentation fix in the `README.md` for ignoring `socket.io` routes.
* Better support for disabling browser timing headers server side. Previously
  the agent would not pick up the server change until restart. The agent will
  now disable browser timing headers as soon as the next harvest cycle.
* Fix a `socket hangup error` that was causing some agents to fail to
  handshake with the New Relic servers.

### v1.4.0 (2014-03-14):

* Browser monitoring! Real User Monitoring! Which is also known as RUM!
  Whatever it's called, it allows you to see how long your pages take to load,
  not just on the server side, but in the browser! Wow! It's super cool! We
  know a lot of you have been waiting for this, and it's here! It's manually
  set up with an API call! Check the README for details!
* By default, all communication between New Relic for Node and New Relic's
  servers is now protected with crisp, clean TLS encryption. To minimize the
  CPU overhead of running connections over SSL (and it can be configured, see
  the README and the online documentation for details on how to return to plain
  HTTP), New Relic for Node is now using a keep-alive connection that will
  properly pipeline connections, for both HTTP and HTTPS.
* Improved the timings for a large class of MongoDB / Mongoose use cases. If
  you've encountered the issue where MongoDB trace segments last for an
  absurdly long duration, this should help.

### v1.3.2 (2014-02-12):

* Includes a nearly total rewrite of the connection layer that the module uses
  to communicate with New Relic's servers:
    * More useful logs! All of the logging has been reviewed closely to
      maximize its value and usefulness at pretty much every level. In
      practice, this means that the messages logged at 'info' and higher should
      only be for things that are relevant to you as a customer, and at 'debug'
      and 'trace' should be much more useful for us when we help you isolate
      issues with New Relic in your applications.
    * See data faster! As part of the connection handshake with New Relic, the
      module will now send any performance metrics gathered during the startup
      cycle immediately, instead of waiting a minute for the first full harvest
      cycle.
    * Get data to New Relic more reliably! When the module has issues
      connecting to New Relic, it's more consistent and resilient about holding
      your performance data for later delivery.
    * Use less bandwidth! Performance data delivery to New Relic is now
      sequential instead of simultaneous.  This means that the bandwidth used
      by New Relic will be less bursty, especially on hosts running many
      instrumented applications (or cluster workers).
    * Better implementation! There were a number of architectural problems with
      the old version of the connection layer, which (among other things) made
      it difficult to test.  The new version is simpler, has a much cleaner
      API, and has many, many more tests.

### v1.3.1 (2014-01-31):

* Ignored status codes are now always casted to numbers so that people using
  environment-variable configuration or strings in config still get error
  status ignored properly.
* If you disabled server-side configuration, the server was still able to
  set the value of apdex_t for your app. This was an oversight, and has
  been corrected.
* Before, if you had request renaming rules, if the end result was the same
  as the match pattern (mapping `/path` to `/path`), they would be silently
  ignored. This has been fixed.
* MySQL instrumentation handles callback more consistently, so the transaction
  tracer doesn't get confused and stop tracking transactions with MySQL calls
  in it.

### v1.3.0 (2014-01-17):

* Support for Spumko's Hapi! This support works with both Hapi 1.x and 2.0.0,
  and like our Express and Restify instrumentation will automatically name
  transactions after Hapi paths (get it) and time how long it takes to render
  views.
* Before, transaction naming and ignoring rules didn't work with Express and
  Restify routes. This has been addressed and the documentation has been
  clarified. Much gratitude to everyone who helped us figure out how to get
  this right, and for dealing with the previous, unclear documentation.
* Parameters in the ignored params list weren't being ignored in all cases.
* A very annoyingly chatty log message had its priority level dropped several
  levels.

### v1.2.0 (2013-12-07):

* Before, there were certain circumstances under which an application
  would crash without New Relic installed, but wouldn't crash with it.
  This has been fixed, and applications with New Relic installed now
  crash consistently. The error tracer is now also considerably simpler.
* Added a security policy. See the new section in README.md or read
  SECURITY.md.
* Future-proofed the MongoDB instrumentation and prevented the module from
  breaking GridFS.
* Made a small tweak that should reduce the amount of blocking file I/O done by
  the module.
* The module's instrumentation and harvest cycle will now not hold the process
  open in Node 0.9+. This should make it easier for processes to shut
  themselves down cleanly with New Relic running.
* The environment information gatherer will no longer crash if it tries to read
  a directory where it's expecting a file.
* Errors thrown during the execution of Express routes or Connect middlewares
  that were attached to requests that ended in HTTP status codes configured to
  be ignored by default will now be ignored correctly.
* Made the module play nicer with Node's REPL. It no longer assumes that an
  application necessarily has a main module.
* A few tweaks were made to support the CoolBeans dependency injection
  framework.
* Several log messages were demoted to a less chatty level.

### v1.1.1 (2013-11-08):

* Added the infrastructure necessary to support key transactions and New
  Relic's new alerting policies.
* The agent no longer renames transactions for requests that end in error to
  the gnomic and unhelpful '400/\*' (or whatever the final HTTP status code
  ends up being). This should make the traced errors tab considerably more
  useful.
* Improved instrumentation for legacy `http.createClient` and `http.Client`
  client methods. A few modules still use these legacy API calls, and the old
  instrumentation was just plain wrong.
* Changed how the error tracer deals with certain kinds of errors to deal with
  differences between Node versions 0.8 and 0.10. It should now convert throws
  into fatal errors less frequently.
* Removed useless fs.readDir instrumentation, which generated a lot of metrics
  but which New Relic was unable to display in any useful form. Maybe it will
  come back someday in a more useful incarnation.

### v1.1.0 (2013-11-05):

* Added a new call to the API, `.noticeError`. See the docs for details, but
  unlike the other calls on the API, you can use this to pass off errors
  anywhere in your app, not just from within web requests.
* Ignoring slow (or polling) requests was only being applied to slow
  transaction traces. It now applies to metrics and transactions that end in
  errors.
* MongoDB, Redis and Memcached now honor the `capture_params` and
  `ignore_params` settings.
* New Relic for Node.js, like New Relic's other agents, has a sophisticated
  system for repeatedly trying to connect to New Relic's servers when the first
  attempt results in failure. This had been broken since (roughly) January. It
  works again now.
* The built-in debugging for the transaction tracer was out of date with
  respect to the production tracer. This is fixed, and you're welcome to
  satisfy your curiosity by enabling it, but it's really not going to be useful
  to you unless you feel like taking the time to understand what the tracer is
  doing at a low level. Do not ever enable it in production, as it slaughters
  the tracer's performance and generates a huge pile of objects per
  transaction.

### v1.0.1 (2013-10-30):

* Added a new setIgnoreTransaction call to the exported API to allow explicit
  control over whether transactions should be ignored or not. Mark those
  polling routes to be ignored! Pull your crazy custom favicon.ico renderer out
  of the ignore list!
* The module will no longer pollute MongoDB queries with New Relic-only
  parameters. Thanks to Alon Salant for identifying this issue, and all
  apologies to him for the trouble it caused him.
* The instrumentation for MongoDB, memcached, Redis, and Express will now
  honor the setting of the `capture_params` configuration flag. Before the
  module always captured query parameters.
* Fixed a problem that would cause New Relic for Node to fail on versions of
  Node between 0.8.0 and 0.8.3.
* Upgraded to the newest version of `continuation-local-storage`, which has
  many fixes for dealing with monkeypatched EventEmitters.

### v1.0.0 (2013-10-24):

* General release. No code changes from v0.12.1.

### v0.12.1 / beta-38 (2013-10-17):

* The transaction namer wasn't respecting error_collector.ignore_error_codes.
  We've unified the code paths there so that this no longer happens, so that
  if the status code of a request is in the list of codes to be ignored, it's
  no longer rolled up under that status code and gets its normal name.

### v0.12.0 / beta-37 (2013-10-16):

* Changed how MongoDB, MySQL, memcached, and Redis metrics are reported to New
  Relic. This is part of a larger effort to make the Monitoring > Database tab
  of the New Relic UI more useful for Node developers. There will be a brief
  period where your dashboards will have both the old and new metrics, which
  could lead to some temporary duplication or metric names. These "duplicates"
  will gradually stop showing up as the reporting windows containing the old
  metric names expire. Be sure to let us know if you have strong feelings one
  way or another about this change, as it's a work in progress.
* Updated the module's dependencies to fix another subtle bug in how
  error-handling works in Node 0.8.x. This should resolve the errors some users
  were seeing.

### v0.11.9 / beta-36 (2013-10-12):

* Fixed a crash in the tracer that could turn a recoverable application error
  into an unrecoverable process crash. Mea culpa, our apologies for the
  inconvenience if you ran into this. In our defence, the errors we're running
  into are getting ever more exotic as we get most of the common stuff nailed
  down.
* Added the ability to use the preconfigured Azure Web Server name as the
  application name for a Node app. Thanks to New Relic .NET engineer Nick Floyd
  for the suggestion.

### v0.11.8 / beta-35 (2013-10-11):

* Added a license entry to package.json.
* Due to an npm bug, the module package got huge. This one is much smaller.

### v0.11.7 / beta-34 (2013-10-11):

* The last build of the agent had a flaw in how it dealt with outbound requests
  that made it way too stringent about dealing with default ports. It is now
  more sane about defaults.
* The behavior of configuration precedence is slightly different now.
  Previously, if there were list values set in the defaults, configuration
  file, environment variables, or server-side configuration, they would be
  concatenated instead of being overwritten.  This made it impossible to
  override some of the defaults (most notably, it was impossible to not ignore
  HTTP status code 404 in the error tracer), so now the configuration file will
  overwrite the defaults, and environment variables will overwrite the
  configuration file.  Values sent by New Relic will still be concatenated
  instead of overwriting, though (again, this only affects configuration
  variables with list values). Thanks to GitHub user grovr for identifying
  the problem!
* The error tracer will collect errors off transactions after the first harvest
  cycle (thanks to GitHub user grovr for identifying this issue).
* `cluster` users will no longer see occasional crashes due to New Relic's
  instrumentation.
* Fixed a few minor documentation errors that made it tough to use the
  suggested ignoring rules for socket.io transactions.

### v0.11.6 / beta-33 (2013-10-08):

* Changed the module to not load the instrumentation *at all* if the agent is
  disabled via configuration. This will keep the module from leaking any
  resources when it's disabled.
* The agent used to include query parameters in the name for outbound requests,
  making for unwieldy-looking trace segments.  Those parameters are now
  stripped off, and if `capture_params` (and `ignored_params`) are enabled,
  parameters will be captured for (nicely-formatted) display.
* Added a stubbed API so that when the agent is disabled, calls to the New
  Relic API will not throw. Add naming calls to your code with impunity!
* The module now looks in many more places for `newrelic.js` before complaining
  that it can't be found. In order, it looks in the current working directory,
  the directory of the Node process's main module (normally whatever file you
  pass to node on the command line), the directory pointed to by the
  environment variable `NEW_RELIC_HOME`, the current process's `$HOME`, and the
  directory above the node_modules directory where `newrelic` is installed.

### v0.11.5 / beta-32 (2013-10-03):

* Fixed a major issue in the transaction tracer that affected users of certain
  Express middleware plugins. HUGE thanks to Nicolas Laplante for his
  assistance in isolating and reproducing the bug, and also to the denizens of
  #libuv for eyeballing my various unsuccessful attempts at a fix.
* Fixed another issue in the tracer where certain objects were being wrapped
  too many times. Thanks to José F. Romaniello for confirming the fix.
* Changed how requests handled by Express and Restify routes are named. This
  change is being rolled out both in this module and on the New Relic website,
  so there is a chance you will see the same route (or very similiar routes)
  show up twice in aggregated metrics.
* Dropped the default apdex tolerating value from 500 milliseconds to 100
  milliseconds. This means that transactions slower than 400 milliseconds will
  generate slow transaction traces. Read the documentation in README.md on
  `apdex_t` and `apdex_f` for further details.

### v0.11.4 / beta-31 (2013-10-01):

* Fixed an error in the Connect and Express middleware instrumentation. Another
  tip of the hat to Jeff Howell at Kabam for identifying this problem and
  pointing to a solution!

### v0.11.3 / beta-30 (2013-10-01):

* Rewrote the MongoDB instrumentation. Big thanks to Jeff Howell at Kabam for
  demonstrating a much more reliable and simple approach than what we had
  before! Also expanded the number of MongoDB methods instrumented to include
  more of the common operations and indexing operations.
* Changed the default value of the `top_n` configuration parameter. Read the
  documentation in `lib/config.default.js` for the details (we've taken another
  run at making the docs for `top_n` easier to understand), but the upshot is
  that by default you should see a greater diversity of slow transaction traces
  now.
* Closed a hole in the transaction tracer related to Connect and Express-style
  middleware chains.
* Fixed issues identified by testing against various versions of 0.11 and
  master.
* Added guidelines for contributing to the module. Read CONTRIBUTING.md
  for details.

### v0.11.2 / beta-29 (2013-09-25):

* Fixed a bug with the Connect instrumentation that would cause it to
  crash when using Connect's static middleware in strict mode. Using
  ES5 future reserved keywords for function names is a bad idea, and
  this is why, but static's name is highly unlikely to change. For
  those of you who are examining the state of your middleware stack after
  configuring it, you probably shouldn't be doing that, but if you run into
  problems with the New Relic agent installed, try changing your test to use
  `name.indexOf('whatever') === 0` as the predicate instead of
  `name === 'whatever'`.

### v0.11.1 / beta-28 (2013-09-24):

* Prevent requests from being double-counted by changing the tracer to
  always reuse existing transactions rather than trying to nest them.
* Changed the Connect instrumentation to preserve the names of middleware
  functions after wrapping them. If you need this change, you should
  probably change your code so you don't need it anymore.
* Added a bunch of server-side configuration options that are known but
  unsupported to the agent.

### v0.11.0 / beta-27 (2013-09-20):

* IMPORTANT. There have been MAJOR CHANGES in how requests are named for
  display and aggregation in the New Relic user interface. Read the section in
  the README on transactions and request naming for details. For good measure,
  read it twice. If your requests are all still ending up named `/*`, read
  it a third time. This is **especially** true if you're not using Express
  or Restify, in which case you will almost certainly want to make changes
  in how you configure New Relic.
* IMPORTANT. New Relic for Node.js now supports the full range of server-side
  configuration options offered by the New Relic web interface. By default,
  server-side settings will override the settings in your configuration file
  (or environment variables). You can disable server-side configuration by
  setting `ignore_server_configuration` to `true` in your configuration file
  (or setting `NEW_RELIC_IGNORE_SERVER_CONFIGURATION` to 'true').
* BREAKING CHANGE: The New Relic module now exports an API to be used for
  naming transactions and for adding URL to transaction name mapping rules. If
  you were using `require('newrelic')` as an interface to the agent's
  configuration or its internals, you'll need to fix your code (also you
  probably shouldn't have been doing that).
* BREAKING CHANGE: The configuration parameter
  `transaction_tracer.trace_threshold` has been renamed
  `transaction_tracer.transaction_threshold` to make it consistent with New
  Relic's other agents.
* Applications using the Express or Restify routers will now have their
  requests named after the matching routes. These names can be overridden
  but the transaction-naming API.
* There are new configuration parameters for adding rules for naming or
  ignoring requests. The README has a good example for how to keep socket.io
  from blowing out your average response time. You should read it!
* Tweaked the calculation of exclusive time in transaction traces, which
  should make more of the transaction trace detail pages make sense.

### v0.10.3 / beta-26 (2013-08-25):

* Fixed a regression in `beta-25` that caused the agent to incorrectly
  calculate an important timestamp, thus leading to data not showing up
  in New Relic.
* Improved in-memory aggregation (when the connection between the agent
  and New Relic is unavailable or failing).

### v0.10.2 / beta-25 (2013-08-23):

* Fixed a serious error in how the agent handles communication errors
  when sending errors to New Relic. If you're running v0.10.0 or v0.10.1,
  upgrade sooner rather than later, as those versions are losing data.
* Substantially improved the quality of reporting on errors noticed by the
  Node agent. Stack traces, scopes, and messages should be much better.

### v0.10.1 / beta-24 (2013-08-19):

* The instrumentation for `http` no longer assumes that the hostname for
  external requests will be named `host` (`hostname` is also allowed, and
  `http.request()` defaults to `localhost`).
* The Node agent and New Relic's servers disagreed about what many metrics
  should be called. The agent was wrong and it regrets the error.
* Minor tweaks to database instrumentation (MongoDB and MySQL) that could have
  a small but visible impact on the overview display.

### v0.10.0 / beta-23 (2013-08-17):

* IMPORTANT. The transaction tracer in this build is COMPLETELY NEW. This means
  that the agent will probably work just fine under Node 0.8 and newer, but
  Node versions 0.6 and older are presently unsupported, and support for them
  may or may not come back. However, the quality of the metrics gathered by the
  agent is now vastly improved.
* There are over 100 commits included in this build. Every effort has been made
  to ensure that we will not crash your applications, but be aware there may be
  regressions.
* Substantially more information is displayed by New Relic for slow transaction
  traces. How this information is displayed is a work in progress, as New Relic
  works to create a consistent user experience for developers writing both
  synchronous and asynchronous applications.
* Most Redis and memcached operations will now provide details on which keys
  were involved in an operation.
* The error tracer has been given a new coat of paint as well, and takes better
  advantage of Node domains, when they're available. Fewer errors should be
  double-counted, as well.
* MongoDB instrumentation is substantially improved.
* Express instrumentation now deals with the removal of the (very helpful)
  version field from recent versions of Express.
* Exclusive durations are reported for metrics, improving transaction
  breakdowns.
* Several bugs in the communication between the New Relic agent and New Relic's
  servers have been fixed.
* Failed connection attempts between the agent and New Relic's servers no longer
  cause aggregated metrics to be lost, nor will this trigger an agent crash.

### v0.9.22 / beta-22 (2013-06-11):

* Capture request URL before Express can mess with it.

### v0.9.21 / beta-21 (2013-06-04):

* Don't try to connect without a license key.
* Clear out previous connection listeners on failed connection attempts.
* Don't crash when normalizing paths without a leading slash.

### v0.9.20 / beta-20 (2013-03-28):

* The implementation of domains changed in Node 0.10.x, which necessitated
  a fair amount of work on the error tracer to preserve the existing
  error tracer behavior.
* The error tracer no longer improperly swallows thrown errors.
* The agent no longer assumes that a home directory is set.
* The agent now works correctly with the `should` assertion helper
  library.

### v0.9.19 / beta-19 (2013-03-04):

* HTTPS instrumentation is both more complete and far better tested.
* Restify servers using HTTPS listeners should now be properly
  instrumented.

### v0.9.18-137 / beta-18 (2013-01-30):

* `;` is now treated as a query separator in URLs, just like `?`.
* When using `stdout` or `stderr` for logging and not using a configuration
  file, logging will now work as expected.
* The error-handling code for DNS lookup of New Relic's servers was itself
  erroneous.  It should no longer crash instrumented apps when DNS lookup
  fails.
* Simplified agent startup process.

### v0.9.17-132 / beta-17 (2013-01-24):

* Using fs.readdir will no longer crash the agent and your apps. Oops!
* Added error-tracing middleware for Connect 1 & 2 applications, which includes
  Express 2 and 3 applications. This middleware is inserted automatically and
  transparently. Because it's common for end-user error handlers to not
  propagate errors (by calling next(error) from within the handler), the
  instrumentation inserts the middleware before the first error handler added
  to the middleware chain.
* The node-redis driver now correctly traces Redis calls made without a
  callback.
* Connections to New Relic that partially succeeded will now correctly keep
  attempting to connect until the connection succeeds or the number of retries
  is exhausted.
* Added a handler for yet another kind of New Relic server error
  (RuntimeError).

### v0.9.16-121 / beta-16 (2013-01-16):

* For some of the modules instrumented by the agent (fs, http, Express 2
  and 3), the error tracer now adds error tracing to wrapped function calls.
  This means that more of the functions in those modules will send traced
  errors to New Relic, even if they're trapping errors themselves. Also
  improves error tracer in versions of Node without domains. The error
  tracer rethrows all caught errors, so as to not alter behavior of
  instrumented apps.
* The error count sent by the agent was frequently incorrect due to an
  off-by-one bug.
* Include the entire stacktrace in traced errors.
* When the agent fails to successfully connect to New Relic's servers, it
  will try 6 more times, progressively waiting longer between each failed
  attempt. If no connection can be made, the agent will shut itself down.
* The agent no longer crashes instrumented applications when DNS resolution
  fails during the initial handshake with New Relic's servers. It logs the
  failures instead and retries later.
* The agent no longer alters the behavior of the generic-pool module in a
  way that causes modules using it to break (including node-postgres).
* In some cases, the domains-based error tracer was not working correctly.
* The agent logs significantly more useful debugging information.

### v0.9.15-107 / beta-15 (2013-01-14):

* The agent's built-in compression for sending large payloads to New Relic
	wasn't correctly handling the Buffer returned by zlib, leading to a crash.

### v0.9.14-105 / beta-14 (2013-01-07):

* In some cases, the monkeypatching used by the instrumentation wasn't
  written sufficiently defensively, leading to applications crashing at
  startup when using the agent.
* Changed how packages and dependencies are serialized when sent to New
  Relic's servers.

### v0.9.13-101 / beta-13 (2013-01-07):

* When New Relic's servers (or an intermediate proxy) returned a response with
  a status code other than 20x, the entire instrumented application would
  crash.
* Some metric normalization rules were not being interpreted correctly, leading
  to malformed normalized metric names.
* Metric normalization rules that specifed that matching metrics were to be
  ignored were not being enforced.

### v0.9.12-91 / beta-12 (2012-12-28):

* Fixed the agent's auto-restart support to cleanly shut down the
  connection (also fixed a bunch of bugs in restart).

### v0.9.11-88 / beta-11 (2012-12-20):

* When server-side configuration changes, the agent will now correctly
  restart when told to do so by New Relic's servers.
* Correctly wrap net.Server.prototype.listen -- wasn't returning the
  server object, which broke some apps.
* If you're on a SmartOS VM with a 64-bit base image and a 64-bit build of
  Node that's v0.8.5 or earlier, the agent will no longer cause Node to
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
