[![Community Project header](https://github.com/newrelic/opensource-website/raw/master/src/images/categories/Community_Project.png)](https://opensource.newrelic.com/oss-category/#community-project)

# New Relic AWS SDK instrumentation [![Coverage Status][1]][2]
New Relic's official AWS-SDK package instrumentation for use with the
[Node agent](https://github.com/newrelic/node-newrelic).

## Installation and getting started
It can be installed and loaded independently:

```
npm install @newrelic/aws-sdk
```
```js
// index.js
require('@newrelic/aws-sdk')
```

For more information, please see the agent [installation guide][3], and
[compatibility and requirements][4].

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
We encourage your contributions to improve New Relic AWS SDK instrumentation! Keep in mind when you submit your pull request, you'll need to sign the CLA via the click-through using CLA-Assistant. You only have to sign the CLA one time per project.

If you have any questions, or to execute our corporate CLA, required if your contribution is on behalf of a company, please drop us an email at opensource@newrelic.com.

## License
New Relic AWS SDK instrumentation is licensed under the [Apache 2.0](http://apache.org/licenses/LICENSE-2.0.txt) License.

New Relic AWS SDK instrumentation also uses source code from third-party libraries. You can find full details on which libraries are used and the terms under which they are licensed in the third-party notices document.

[1]: https://coveralls.io/repos/github/newrelic/node-newrelic-aws-sdk/badge.svg?branch=master
[2]: https://coveralls.io/github/newrelic/node-newrelic-aws-sdk?branch=master
[3]: https://docs.newrelic.com/docs/agents/nodejs-agent/installation-configuration/install-nodejs-agent
[4]: https://docs.newrelic.com/docs/agents/nodejs-agent/getting-started/compatibility-requirements-nodejs-agent
