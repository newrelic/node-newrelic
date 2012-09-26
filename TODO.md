### KNOWN ISSUES:

* The overhead incurred by the agent is too high for high-load production
  apps.
* The agent works only with Node.js 0.6 and newer.
* The agent uses memory very inefficiently.
* Transaction traces do not correctly set up the parent-child call
  relationships necessary for meaningful transaction traces.
* Server-side configuration is unavailable until support is added within
  the core New Relic application.
* Transaction tracing can't actually be disabled right now.

### TO DO:

* Replace callstack-based shim.
* Refine how transaction traces gather and report time used.
* Better tests for existing instrumentation.
* Instrumentation for HTTPS connections.
* Additional third-party instrumentation:
    1. Redis
    2. PostgreSQL
    3. CouchDB
    4. mikael/request
* Publish a build of the agent via npm.
* Proxy support.
* Lots more testing of what the data looks like in RPM.
* Simpler instrumentation for web services using the core HTTP module.
