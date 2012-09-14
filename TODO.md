### KNOWN ISSUES:

* The overhead incurred by the agent is too high for high-load production
  apps.
* The method used to make instrumentation pervasive touches a lot of the
  core of Node.js and is both slow and potentially fragile.
* The agent works only with Node.js 0.8.0 and newer.
* The agent uses memory very inefficiently.
* Transaction traces do not correctly set up the parent-child call
  relationships necessary for meaningful transaction traces.

### TO DO:

* Additional third-party instrumentation:
    1. Redis
    2. PostgreSQL
    2. CouchDB
    2. mikael/request
* Proxy support.
* Better tests for existing instrumentation.
* Replace callstack-based shim with domains.
* Lots more testing of what the data looks like in RPM.
* Publish a build of the agent via NPM.
* Refine how transaction traces gather and report time used.
