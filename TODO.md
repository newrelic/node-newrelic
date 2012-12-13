### KNOWN ISSUES:

* The CPU and memory overhead incurred by the Node agent is relatively
  minor (~1-10%, depending on how much of the instrumentation your
  apps end up using), but may not be appropriate for production use.
  In particular, GC activity is significantly increased due to the
  large number of ephemeral objects created by metrics gathering. For
  now, be judicious about which production apps you install the agent in.
  It may not be appropriate for latency-sensitive or high-throughput
  applications.
* There are irregularities around transaction trace capture and display.
  If you notice missing or incorrect information from transaction traces,
  let us know. If possible, include the package.json for your application
  with your report.
* The agent works only with Node.js 0.6 and newer.
* When using Node's included clustering support, each worker process will
  open its own connection to New Relic's servers, and will incur its own
  overhead costs.

### TO DO:

* Additional third-party instrumentation:
    1. PostgreSQL (probably not pre-GA)
    2. CouchDB (not pre-GA)
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
