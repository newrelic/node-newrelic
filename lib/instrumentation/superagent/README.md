<a href="https://opensource.newrelic.com/oss-category/#community-plus"><picture><source media="(prefers-color-scheme: dark)" srcset="https://github.com/newrelic/opensource-website/raw/main/src/images/categories/dark/Community_Plus.png"><source media="(prefers-color-scheme: light)" srcset="https://github.com/newrelic/opensource-website/raw/main/src/images/categories/Community_Plus.png"><img alt="New Relic Open Source community plus project banner." src="https://github.com/newrelic/opensource-website/raw/main/src/images/categories/Community_Plus.png"></picture></a>

# New Relic SuperAgent instrumentation

[![npm status badge][5]][6] [![superagent Instrumentation CI][1]][2] [![codecov][7]][8]

New Relic's official SuperAgent framework instrumentation for use with the
New Relic [Node.js agent](https://github.com/newrelic/node-newrelic).

This module is a dependency of the agent and is installed by default when you install the agent.

## Installation and Getting Started
This package is a dependency of the the [Node.js Agent](https://github.com/newrelic/node-newrelic/blob/main/package.json#L191), and should not need to install it manually.

For more information, please see the agent [installation guide][3] and [compatibility and requirements][4].

Our [API and developer documentation](http://newrelic.github.io/node-newrelic/) for writing instrumentation will be of help. We particularly recommend the tutorials and various "shim" API documentation.

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

Should you need assistance with New Relic products, you are in good hands with several support channels.

If the issue has been confirmed as a bug or is a feature request, please file a GitHub issue.

**Support Channels**

* [New Relic Documentation](https://docs.newrelic.com/docs/agents/nodejs-agent/getting-started/introduction-new-relic-nodejs): Comprehensive guidance for using our platform
* [New Relic Community](https://forum.newrelic.com/): The best place to engage in troubleshooting questions
* [New Relic Developer](https://developer.newrelic.com/): Resources for building a custom observability applications
* [New Relic University](https://learn.newrelic.com/): A range of online training for New Relic users of every level
* [New Relic Technical Support](https://support.newrelic.com/) 24/7/365 ticketed support. Read more about our [Technical Support Offerings](https://docs.newrelic.com/docs/licenses/license-information/general-usage-licenses/support-plan).


## Privacy
At New Relic we take your privacy and the security of your information seriously, and are committed to protecting your information. We must emphasize the importance of not sharing personal data in public forums, and ask all users to scrub logs and diagnostic information for sensitive information, whether personal, proprietary, or otherwise.

We define “Personal Data” as any information relating to an identified or identifiable individual, including, for example, your name, phone number, post code or zip code, Device ID, IP address and email address.

For more information, review [New Relic’s General Data Privacy Notice](https://newrelic.com/termsandconditions/privacy).

## Contribute

We encourage your contributions to improve the superagent instrumentation module! Keep in mind when you submit your pull request, you'll need to sign the CLA via the click-through using CLA-Assistant. You only have to sign the CLA one time per project.

If you have any questions, or to execute our corporate CLA, required if your contribution is on behalf of a company,  please drop us an email at opensource@newrelic.com.

**A note about vulnerabilities**

As noted in our [security policy](https://github.com/newrelic/node-newrelic-superagent/security/policy), New Relic is committed to the privacy and security of our customers and their data. We believe that providing coordinated disclosure by security researchers and engaging with the security community are important means to achieve our security goals.

If you believe you have found a security vulnerability in this project or any of New Relic's products or websites, we welcome and greatly appreciate you reporting it to New Relic through [HackerOne](https://hackerone.com/newrelic).

If you would like to contribute to this project, review [these guidelines](./CONTRIBUTING.md).

To [all contributors](https://github.com/newrelic/node-newrelic-superagent/graphs/contributors), we thank you!  Without your contribution, this project would not be what it is today.  We also host a community project page dedicated to [New Relic SuperAgent (Node)](https://opensource.newrelic.com/projects/newrelic/node-newrelic-superagent).

## License
New Relic SuperAgent instrumentation is licensed under the [Apache 2.0](http://apache.org/licenses/LICENSE-2.0.txt) License.

New Relic SuperAgent instrumentation also uses source code from third-party libraries. You can find full details on which libraries are used and the terms under which they are licensed in the third-party notices document.

[1]: https://github.com/newrelic/node-newrelic-superagent/workflows/superagent%20Instrumentation%20CI/badge.svg
[2]: https://github.com/newrelic/node-newrelic-superagent/actions?query=workflow%3A%22superagent+Instrumentation+CI%22
[3]: https://docs.newrelic.com/docs/agents/nodejs-agent/installation-configuration/install-nodejs-agent
[4]: https://docs.newrelic.com/docs/agents/nodejs-agent/getting-started/compatibility-requirements-nodejs-agent
[5]: https://img.shields.io/npm/v/@newrelic/superagent.svg
[6]: https://www.npmjs.com/package/@newrelic/superagent
[7]: https://codecov.io/gh/newrelic/node-newrelic-superagent/branch/main/graph/badge.svg
[8]: https://codecov.io/gh/newrelic/node-newrelic-superagent
