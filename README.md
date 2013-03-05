# New Relic Node.js agent

This package instruments your application for performance monitoring
with [New Relic](http://newrelic.com).

This is a beta release. You should probably try it in your staging or
development environment first. If you would prefer to wait for the GA
release, please [sign up](http://try.newrelic.com/nodejs) to be notified.

Make sure you have a [New Relic account](http://newrelic.com) before
starting. To see all the features, such as slow transaction traces, you will
need a New Relic Pro subscription. Contact your New Relic representative to
request a Pro Trial subscription during your beta testing.

## Getting started

1. [Install node](http://nodejs.org/#download). For now, at least 0.6 is
   required. Some features (e.g. error tracing) depend in whole or in
   part on features in 0.8 and above. Development work on the agent is
   being done against the latest released non-development version of Node.
2. Install this module via `npm install newrelic` for the application you
   want to monitor.
3. Copy `newrelic.js` from `node_modules/newrelic` into the root directory of
   your application.
4. Edit `newrelic.js` and replace `license_key`'s value with the license key
   for your account.
5. Add `require('newrelic');` as the first line of the app's main module.
   *IMPORTANT*: formerly this was `require('newrelic_agent')`, and you *MUST*
   update your code.

If you wish to keep the configuration for the agent separate from your
application, the agent will look for newrelic.js in the directory referenced
by the environment variable `NEWRELIC_HOME` if it's set.

When you start your app, the agent should start up with it and start
reporting data that will appear within [the New Relic
UI](https://rpm.newrelic.com/) after a few minutes. Because the agent
minimizes the amount of bandwidth it consumes, it only reports data once a
minute, so if you add the agent to tests that take less than a minute to run,
the agent won't have time to report data to New Relic. The agent will write
its log to a file named `newrelic_agent.log` in the application directory. If
the agent doesn't send data or crashes your app, the log can help New Relic
determine what went wrong, so be sure to send it along with any bug reports
or support requests.

## Configuring the agent

The agent can be tailored to your app's requirements, both from the server
and via the newrelic.js configuration file you created. For more details on
what can be configured, refer to
[`lib/config.default.js`](https://github.com/newrelic/node-newrelic/blob/master/lib/config.default.js),
which documents the available variables and their default values.

In addition, for those of you running in Heroku, Microsoft Azure or any other
PaaS environment that makes it easier to control configuration via the your
server's environment, all of the configuration variables in newrelic.js have
counterparts that can be set in your service's shell environment. You can
mix and match the configuration file and environment variables freely; the
value found from the environment will always take precedence.

This documentation will be moving to New Relic's servers with the 1.0 release,
but for now, here's a list of the variables and their values:

* `NEW_RELIC_HOME`: path to the directory in which you've placed newrelic.js.
* `NEW_RELIC_APP_NAME`: The name of this application, for reporting to
  New Relic's servers. This value can be also be a comma-delimited list of
  names.
* `NEW_RELIC_ENABLED`: Whether or not the agent should run. Good for
  temporarily disabling the agent while debugging other issues with your
  code.
* `NEW_RELIC_NO_CONFIG_FILE`: Inhibit loading of the configuration file
  altogether. Use with care. This presumes that all important configuration
  will be available via environment variables, and some log messages
  assume that a config file exists.
* `NEW_RELIC_LICENSE_KEY`: Your New Relic license key.
* `NEW_RELIC_LOG`: Complete path to the New Relic agent log, including
  the filename. The agent will shut down the process if it can't create
  this file, and it creates the log file with the same umask of the
  process. Setting this to `stdout` will write all logging to stdout, and
  `stderr` will write all logging to stderr.
* `NEW_RELIC_LOG_LEVEL`: Logging priority for the New Relic agent. Can be one of
  `error`, `warn`, `info`, `debug`, or `trace`. `debug` and `trace` are
  pretty chatty; unless you're helping New Relic figure out irregularities
  with the agent, you're probably best off using `info` or higher.
* `NEW_RELIC_ERROR_COLLECTOR_ENABLED`: Whether or not to trace errors within
  your application. Values are `true` or `false`.
* `NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERROR_CODES`: Comma-delimited list of HTTP
  status codes to ignore. Maybe you don't care if payment is required?
* `NEW_RELIC_TRACER_ENABLED`: Whether to collect and submit slow
  transaction traces to New Relic. Values are `true` or `false`.
* `NEW_RELIC_TRACER_THRESHOLD`: Millisecond duration at which
  a transaction trace will count as slow and be sent to New Relic. Can
  also be set to `apdex_f`, at which point it will set the trace threshold
  to 4 times the current ApdexT.
* `NEW_RELIC_TRACER_TOP_N`: Number of transaction traces to send to New
  Relic on each 60-second harvest cycle. Defaults to 1. This can lead
  to noisy transaction traces and should be used with care.
* `NEW_RELIC_APDEX`: Set the initial Apdex tolerating / threshold value.
  This is more often than not set from the server.
* `NEW_RELIC_HOST`: Hostname for the New Relic collector proxy. You
  shouldn't need to change this.
* `NEW_RELIC_PORT`: Port number on which the New Relic collector proxy
  will be listening.
* `NEW_RELIC_DEBUG_METRICS`: Whether to collect internal supportability
  metrics for the agent. Don't mess with this unless New Relic asks you to.
* `NEW_RELIC_DEBUG_TRACER`: Whether to dump traces of the transaction tracer's
  internal operation. You're welcome to enable it, but it's unlikely to be
  edifying unless you're a New Relic Node.js engineer.

## Recent changes

Information about changes to the agent are in NEWS.md.

### Known issues:

* The agent works only with Node.js 0.6 and newer.
* The metric names displayed in New Relic are a work in progress. The
  flexibility of Node's HTTP handling and routing presents unique
  challenges to the New Relic data model. We're working on a set of
  strategies to improve how metrics are named, but be aware that metric
  names may change over time as these strategies are implemented.
* There are irregularities around transaction trace capture and display.
  If you notice missing or incorrect information from transaction traces,
  let us know.
* External requests (and other calls to modules made as part of a
	transaction) are not being accurately instrumented in many cases.
* There are over 20,000 modules on npm. We can only instrument a tiny
  number of them. Even for the modules we support, there are a very
  large number of ways to use them. If you see data you don't expect on
  New Relic and have the time to produce a reduced version of the code
  that is producing the strange data, it will gratefully be used to
  improve the agent.
* There is an error tracer in the Node agent, but it's a work in progress.
	In particular, it still does not intercept errors that may already be
	handled by frameworks. Also, parts of it depend on the new, experimental
	[domain](http://nodejs.org/api/domain.html) API added in Node 0.8, and
	domain-specific functionality will not work in apps running in
  Node 0.6.x.
* The CPU and memory overhead incurred by the Node agent is relatively
  minor (~1-10%, depending on how much of the instrumentation your
  apps end up using), but may not be appropriate for production use.
  In particular, GC activity is significantly increased due to the
  large number of ephemeral objects created by metrics gathering. For
  now, be judicious about which production apps you install the agent in.
  It may not be appropriate for latency-sensitive or high-throughput
  applications.
* When using Node's included clustering support, each worker process will
  open its own connection to New Relic's servers, and will incur its own
  overhead costs.

### To do:

* Additional third-party instrumentation:
    1. PostgreSQL (probably not pre-GA)
    2. CouchDB (not pre-GA)
* Log rotation for the agent log.
* Better tests for existing instrumentation.
* Differentiate between HTTP and HTTPS connections.
* Proxy support.
* Lots more testing of what the data looks like in RPM.

### New Relic features available for other platforms not yet in Node.js

* Real User Monitoring (RUM)
* custom instrumentation APIs
* slow SQL traces and explain plans
* custom parameters
* supportability metrics
* garbage collector instrumentation
* full server-side configuration
* capacity planning
* thread profiling

## Support

During the beta, our support bandwidth is limited. We cannot guarantee a
specific turn-around on questions and issues. However, we try to reply and
resolve issues promptly and we *greatly* appreciate feedback about how to
make the product better.

Please [submit a ticket](https://support.newrelic.com) if you don't see the
data you expect, if the agent generates an error, if you have a feature that
you would like to see, or if you have a library that you would like
instrumented. In the ticket, please provide as much information as you can
about your application and the issue, including your `newrelic_agent.log`,
`package.json` and app code snippets.

## LICENSE

The New Relic Node.js agent uses code from the following open source projects
under the following licenses:

  bunyan                http://opensource.org/licenses/MIT

The New Relic Node.js agent itself is free-to-use, proprietary software.
Please see the full license (found in LICENSE in this distribution) for
details.
