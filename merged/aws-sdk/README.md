<a href="https://opensource.newrelic.com/oss-category/#community-plus"><picture><source media="(prefers-color-scheme: dark)" srcset="https://github.com/newrelic/opensource-website/raw/main/src/images/categories/dark/Community_Plus.png"><source media="(prefers-color-scheme: light)" srcset="https://github.com/newrelic/opensource-website/raw/main/src/images/categories/Community_Plus.png"><img alt="New Relic Open Source community plus project banner." src="https://github.com/newrelic/opensource-website/raw/main/src/images/categories/Community_Plus.png"></picture></a>

# New Relic AWS SDK Instrumentation
[![npm status badge][5]][6] [![aws-sdk Instrumentation CI][1]][2] [![codecov][3]][4]

New Relic's official AWS SDK package instrumentation for use with [the Node.js agent](https://github.com/newrelic/node-newrelic). Provides instrumentation for the [AWS SDK (`aws-sdk`)](https://www.npmjs.com/package/aws-sdk) npm package.

## Installation

This package is [a dependency of the the Node Agent](https://github.com/newrelic/node-newrelic/blob/2121ffdc5001ea1bf9ab473138b9446c1f2a7eef/package.json#L147), and the average user should not need to install it manually.

## Getting Started

Our instrumentation automatically tracks all SDK calls as "external" activities. In addition, the following have more specific instrumentation to capture additional data store or queue information.

- Amazon DynamoDB
- Amazon Simple Notification Service (SNS)
- Amazon Simple Queue Service (SQS)

## Testing

This module includes a list of unit and functional tests.  To run these tests, use the following command

    $ npm run test

You may also run individual test suites with the following commands

    $ npm run unit
    $ npm run versioned

## Support

Should you need assistance with New Relic products, you are in good hands with several support channels.

If the issue has been confirmed as a bug or is a feature request, please file a GitHub issue.

**Support Channels**

* [New Relic and AWS](https://docs.newrelic.com/docs/accounts/install-new-relic/partner-based-installation/new-relic-aws-amazon-web-services). AWS specific agent documentation
* [New Relic Documentation](https://docs.newrelic.com/docs/agents/nodejs-agent/getting-started/introduction-new-relic-nodejs): Comprehensive guidance for using our platform
* [New Relic Community](https://forum.newrelic.com/): The best place to engage in troubleshooting questions
* [New Relic Developer](https://developer.newrelic.com/): Resources for building a custom observability applications
* [New Relic University](https://learn.newrelic.com/): A range of online training for New Relic users of every level
* [New Relic Technical Support](https://support.newrelic.com/) 24/7/365 ticketed support. Read more about our [Technical Support Offerings](https://docs.newrelic.com/docs/licenses/license-information/general-usage-licenses/support-plan).

## Privacy

At New Relic we take your privacy and the security of your information seriously, and are committed to protecting your information. We must emphasize the importance of not sharing personal data in public forums, and ask all users to scrub logs and diagnostic information for sensitive information, whether personal, proprietary, or otherwise.

We define "Personal Data" as any information relating to an identified or identifiable individual, including, for example, your name, phone number, post code or zip code, Device ID, IP address and email address.

Please review [New Relic’s General Data Privacy Notice](https://newrelic.com/termsandconditions/privacy) for more information.

## Roadmap
See our [roadmap](https://github.com/newrelic/node-newrelic/blob/main/ROADMAP_Node.md), to learn more about our product vision, understand our plans, and provide us valuable feedback.

## Contribute

We encourage your contributions to improve New Relic's AWS SDK Instrumentation! Keep in mind when you submit your pull request, you'll need to sign the CLA via the click-through using CLA-Assistant. You only have to sign the CLA one time per project.

If you have any questions, or to execute our corporate CLA, required if your contribution is on behalf of a company, please drop us an email at opensource@newrelic.com.

**A note about vulnerabilities**

As noted in our [security policy](https://github.com/newrelic/node-newrelic-aws-sdk/security/policy), New Relic is committed to the privacy and security of our customers and their data. We believe that providing coordinated disclosure by security researchers and engaging with the security community are important means to achieve our security goals.

If you believe you have found a security vulnerability in this project or any of New Relic's products or websites, we welcome and greatly appreciate you reporting it to New Relic through [HackerOne](https://hackerone.com/newrelic).

If you would like to contribute to this project, please review [these guidelines](https://github.com/newrelic/node-newrelic-aws-sdk/blob/main/CONTRIBUTING.md).

To [all contributors](https://github.com/newrelic/node-newrelic-aws-sdk/graphs/contributors), we thank you! Without your contribution, this project would not be what it is today. We also host a community project page dedicated to
the [New Relic AWS SDK Instrumentation](https://opensource.newrelic.com/newrelic/node-newrelic-aws-sdk) package.

## License
The New Relic AWS SDK Instrumentation package is licensed under the [Apache 2.0](http://apache.org/licenses/LICENSE-2.0.txt) License.

[1]: https://github.com/newrelic/node-newrelic-aws-sdk/workflows/aws-sdk%20Instrumentation%20CI/badge.svg
[2]: https://github.com/newrelic/node-newrelic-aws-sdk/actions?query=workflow%3A%22aws-sdk+Instrumentation+CI%22
[3]: https://codecov.io/gh/newrelic/node-newrelic-aws-sdk/branch/main/graph/badge.svg?token=26ZH9QhLNn
[4]: https://codecov.io/gh/newrelic/node-newrelic-aws-sdk
[5]: https://img.shields.io/npm/v/@newrelic/aws-sdk.svg
[6]: https://www.npmjs.com/package/@newrelic/aws-sdk
