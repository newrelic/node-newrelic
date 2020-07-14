[![Community Project header](https://github.com/newrelic/opensource-website/raw/master/src/images/categories/Community_Project.png)](https://opensource.newrelic.com/oss-category/#community-project)

# New Relic SuperAgent instrumentation [![superagent Instrumentation CI][1]][2]
New Relic's official SuperAgent framework instrumentation for use with the
New Relic [Node.js agent](https://github.com/newrelic/node-newrelic).

This module is a dependency of the agent and is installed by default when you install the agent.

## Installation and getting started
Typically, most users use the version auto-installed by the agent. You can see agent install instructions [here](https://github.com/newrelic/node-newrelic#installation-and-getting-started).

In some cases, installing a specific version is ideal. For example, new features or major changes might be released via a major version update to this module, prior to inclusion in the main New Relic Node.js agent.

```
npm install @newrelic/superagent
```

```js
// index.js
require('@newrelic/superagent')
```

For more information, please see the agent [installation guide][3] and [compatibility and requirements][4].

Our [API and developer documentation](http://newrelic.github.io/node-newrelic/docs/) for writing instrumentation will be of help. We particularly recommend the tutorials and various "shim" API documentation.

## Testing
The module includes a suite of unit and functional tests which should be used to
verify that your changes don't break existing functionality.

All tests are stored in `tests/` and are written using
[Node-Tap](https://www.npmjs.com/package/tap) with the extension `.tap.js`.

To run the full suite, run: `npm test`.

Individual test scripts include:

```
npm run unit
npm run versioned
```

## Support
New Relic hosts and moderates an online forum where you can interact with New Relic employees as well as other customers to get help and share best practices. Like all official New Relic open source projects, there's a related Community topic in the New Relic Explorers Hub. You can find this project's topic/threads here: https://discuss.newrelic.com/c/support-products-agents/node-js-agent/.

## Contributing
We encourage your contributions to improve New Relic SuperAgent instrumentation! Keep in mind when you submit your pull request, you'll need to sign the CLA via the click-through using CLA-Assistant. You only have to sign the CLA one time per project.

If you have any questions, or to execute our corporate CLA, required if your contribution is on behalf of a company, please drop us an email at opensource@newrelic.com.

## License
New Relic SuperAgent instrumentation is licensed under the [Apache 2.0](http://apache.org/licenses/LICENSE-2.0.txt) License.

New Relic SuperAgent instrumentation also uses source code from third-party libraries. You can find full details on which libraries are used and the terms under which they are licensed in the third-party notices document.

[1]: https://github.com/newrelic/node-newrelic-superagent/workflows/superagent%20Instrumentation%20CI/badge.svg
[2]: https://github.com/newrelic/node-newrelic-superagent/actions?query=workflow%3A%22superagent+Instrumentation+CI%22
[3]: https://docs.newrelic.com/docs/agents/nodejs-agent/installation-configuration/install-nodejs-agent
[4]: https://docs.newrelic.com/docs/agents/nodejs-agent/getting-started/compatibility-requirements-nodejs-agent
