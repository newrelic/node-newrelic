[![Coverage Status](https://coveralls.io/repos/github/newrelic/node-newrelic-koa/badge.svg?branch=psvet%2Fcoveralls)](https://coveralls.io/github/newrelic/node-newrelic-koa?branch=psvet%2Fcoveralls)

New Relic's official Koa framework instrumentation for use with the [Node agent](https://github.com/newrelic/node-newrelic). This module is a dependency of the agent and is installed with it by running:

```
npm install newrelic
```

Alternatively, it can be installed and loaded independently based on specific versioning needs:
```
npm install @newrelic/koa
```
```js
// index.js
require('@newrelic/koa')
```

### Supported routing modules

- `koa-router`
- `koa-route`

For more information, please see the agent [installation guide](https://docs.newrelic.com/docs/agents/nodejs-agent/installation-configuration/install-nodejs-agent), and [compatibility and requirements](https://docs.newrelic.com/docs/agents/nodejs-agent/getting-started/compatibility-requirements-nodejs-agent).
