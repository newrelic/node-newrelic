### KNOWN ISSUES:

* The metric names displayed in New Relic are a work in progress. The
  flexibility of Node's HTTP handling and routing presents unique
  challenges to the New Relic data model. We're working on a set of
  strategies to improve how metrics are named, but be aware that metric
  names may change over time as these strategies are implemented.
* There are irregularities around transaction trace capture and display.
  If you notice missing or incorrect information from transaction traces,
  let us know.
* There are over 20,000 modules on npm. We can only instrument a tiny
  number of them. Even for the modules we support, there are a very
  large number of ways to use them. If you see data you don't expect on
  New Relic and have the time to produce a reduced version of the code
  that is producing the strange data, it will be gratefully used to
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
* The agent works only with Node.js 0.6 and newer.
* When using Node's included clustering support, each worker process will
  open its own connection to New Relic's servers, and will incur its own
  overhead costs.

### TO DO:

* Additional third-party instrumentation:
    1. PostgreSQL (probably not pre-GA)
    2. CouchDB (not pre-GA)
* Log rotation for the agent log.
* Better tests for existing instrumentation.
* Differentiate between HTTP and HTTPS connections.
* Proxy support.
* Lots more testing of what the data looks like in RPM.

### NEW RELIC FEATURES AVAILABLE FOR OTHER LANGUAGES NOT YET IN NODE.JS

* Real User Monitoring (RUM)
* slow SQL traces and explain plans
* custom parameters
* supportability metrics
* garbage collector instrumentation
* full server-side configuration
* capacity planning
* thread profiling
