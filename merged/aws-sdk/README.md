[![Community Project header](https://github.com/newrelic/open-source-office/raw/master/examples/categories/images/Community_Project.png)](https://github.com/newrelic/open-source-office/blob/master/examples/categories/index.md#community-project)

# New Relic AWS SDK Instrumentation <!-- TODO: Build Badges -->

New Relic's official AWS-SDK package instrumentation for use with [the Node agent](https://github.com/newrelic/node-newrelic). Provides instrumentation for [the AWS SDK (`aws-sdk`) NPM package](https://www.npmjs.com/package/aws-sdk).

## Installation

This package is [a dependency of the the Node Agent](https://github.com/newrelic/node-newrelic/blob/2121ffdc5001ea1bf9ab473138b9446c1f2a7eef/package.json#L147), and the average user should not need to install it manually.

If you are not the average user, you can add this package to your projet using your package manager of choice (`npm` below), and then `require` the module into your project.

```
    $ npm install @newrelic/aws-sdk
```

```javascript
// index.js
require('@newrelic/aws-sdk')
```

## Getting Started

The library provides automatic instrumentation for the following services of the AWS SDK

- DynamoDB
- Simple Notification Service
- Amazon Simple Queue Service

## Testing

This module includes a list of unit and functional tests.  To run these tests, use the following command

    $ npm run test

You may also run individual test suites with the following commands

    $ npm run unit
    $ npm run versioned

Some of these tests require [that AWS Credentials](https://docs.aws.amazon.com/amazonswf/latest/awsrbflowguide/set-up-creds.html) be set.

    export AWS_ACCESS_KEY_ID=your_access_key_id
    export AWS_SECRET_ACCESS_KEY=your_secret_access_key

## Support

Should you need assistance with New Relic products, you are in good hands with several support channels.

**Support Channels**

* [New Relic and AWS](https://docs.newrelic.com/docs/accounts/install-new-relic/partner-based-installation/new-relic-aws-amazon-web-services)
* [New Relic Community](https://discuss.newrelic.com/c/support-products-agents/node-js-agent/): The best place to engage in troubleshooting questions
* [New Relic Developer](https://developer.newrelic.com/): Resources for building a custom observability applications
* [New Relic University](https://learn.newrelic.com/): A range of online training for New Relic users of every level

## Privacy

At New Relic we take your privacy and the security of your information seriously, and are committed to protecting your information. We must emphasize the importance of not sharing personal data in public forums, and ask all users to scrub logs and diagnostic information for sensitive information, whether personal, proprietary, or otherwise.

We define "Personal Data" as any information relating to an identified or identifiable individual, including, for example, your name, phone number, post code or zip code, Device ID, IP address and email address.

Please review [New Relic’s General Data Privacy Notice](https://newrelic.com/termsandconditions/privacy) for more information.

## Roadmap
See our [roadmap](https://github.com/newrelic/node-newrelic/blob/main/ROADMAP_Node.md), to learn more about our product vision, understand our plans, and provide us valuable feedback. Remove this section if it’s not needed.

## Contributing

We encourage your contributions to improve New Relic's AWS SDK Instrumentation! Keep in mind when you submit your pull request, you'll need to sign the CLA via the click-through using CLA-Assistant. You only have to sign the CLA one time per project.
If you have any questions, or to execute our corporate CLA, required if your contribution is on behalf of a company,  please drop us an email at opensource@newrelic.com.

**A note about vulnerabilities**

As noted in our [security policy](https://github.com/newrelic/.github/blob/master/SECURITY.md), New Relic is committed to the privacy and security of our customers and their data. We believe that providing coordinated disclosure by security researchers and engaging with the security community are important means to achieve our security goals.

If you believe you have found a security vulnerability in this project or any of New Relic's products or websites, we welcome and greatly appreciate you reporting it to New Relic through [HackerOne](https://hackerone.com/newrelic).

If you would like to contribute to this project, please review [these guidelines](https://github.com/newrelic/node-newrelic-aws-sdk/blob/main/CONTRIBUTING.md).

To [all contributors](https://github.com/newrelic/node-newrelic-aws-sdk/graphs/contributors), we thank you!  Without your contribution, this project would not be what it is today.

We also host a community project page dedicated to
[the New Relic AWS SDK Instrumentation package](https://opensource.newrelic.com/newrelic/node-newrelic-aws-sdk).

## License
The New Relic AWS SDK Instrumentation package is licensed under the [Apache 2.0](http://apache.org/licenses/LICENSE-2.0.txt) License.
