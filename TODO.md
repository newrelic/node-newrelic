### KNOWN ISSUES:

* The overhead incurred by the agent is too high for high-load production
  apps.
* The agent works only with Node.js 0.6 and newer.
* Server-side configuration is unavailable until support is added within
  the core New Relic application.
* Instrumentation for the MongoDB driver only properly instruments queries
	that include callbacks -- the promise-style and evented interfaces aren't
	implemented yet.
* Likewise, the MySQL driver only properly instruments queries with callbacks.
	Fortunately, the MySQL driver code is much easier to work with, so full
	support for it should be along presently.
* Transaction tracing can't actually be disabled right now.

### TO DO:

* Refine how transaction traces gather and report time used.
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
