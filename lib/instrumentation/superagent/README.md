[![Coverage Status](https://coveralls.io/repos/github/newrelic/node-newrelic-superagent/badge.svg?branch=master)](https://coveralls.io/github/newrelic/node-newrelic-superagent?branch=master)

New Relic's official `superagent` instrumentation for use with the
[Node agent](https://github.com/newrelic/node-newrelic). This module is a
dependency of the agent and is installed with it by running:

```
npm install newrelic
```

Alternatively, it can be installed and loaded independently based on specific
versioning needs:
```
npm install @newrelic/superagent
```
```js
// index.js
require('newrelic')
require('@newrelic/superagent')
```

For more information, please see the agent
[installation guide](https://docs.newrelic.com/docs/agents/nodejs-agent/installation-configuration/install-nodejs-agent),
and [compatibility and requirements](https://docs.newrelic.com/docs/agents/nodejs-agent/getting-started/compatibility-requirements-nodejs-agent).
