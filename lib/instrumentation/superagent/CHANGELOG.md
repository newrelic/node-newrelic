### 2.0.1 (2020-02-26):

* Support the fixed segment naming in Node 8

### 2.0.0 (2019-10-28):

* **BREAKING** Removed support for Node 6, 7, and 9.

  The minimum supported version is now Node v8. For further information on our support policy, see: https://docs.newrelic.com/docs/agents/nodejs-agent/getting-started/compatibility-requirements-nodejs-agent.

* Added support for Node v12.

### 1.0.3 (2019-03-04):

* Added missing `LICENSE` file.

  Thanks @jreidgreer for the catch!

### 1.0.2 (2019-01-07):

* Updated `@newrelic/test-utilities` dependency to v3.0.0.

### 1.0.1 (2018-11-20):
* Updated versioned test ranges to account for superagent v4 dropping support
  for node versions <6

* Pinned tap version to 11.

### 1.0.0 (2018-09-10):

* Initial release of super agent instrumentation.

  Fixes context state management for callbacks and promises.
