### KNOWN ISSUES:

* The CPU and memory overhead incurred by the Node agent is relatively
	minor (~5-15%, depending on how much of the instrumentation your
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
* Server-side configuration is unavailable until support is added within
  the core New Relic application.
* Instrumentation for the MongoDB driver only properly instruments queries
	that include callbacks -- the promise-style and evented interfaces aren't
	implemented yet.
* Likewise, the MySQL driver only properly instruments queries with callbacks.
	Fortunately, the MySQL driver code is much easier to work with, so full
	support for it should be along presently.
* Transaction tracing can't be disabled right now.
* When using Node's included clustering support, each worker process will
	open its own connection to New Relic's servers, and will incur its own
	overhead costs.

### TO DO:

* Additional third-party instrumentation:
    1. Redis
    2. PostgreSQL
    3. CouchDB
    4. mikael/request
* Use domains for transaction and error tracing when they're available.
* Better tests for existing instrumentation.
* Differentiate between HTTP and HTTPS connections.
* Publish a build of the agent via npm.
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
