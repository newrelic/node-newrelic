[![Community Plus header](https://github.com/newrelic/opensource-website/raw/master/src/images/categories/Community_Plus.png)](https://opensource.newrelic.com/oss-category/#community-plus)

# New Relic's Node.js agent [![Server Smoke Tests][3]][4] [![Node Agent CI][5]][6]

[![npm status badge][1]][2]

This package instruments your application for performance monitoring with [New Relic](https://newrelic.com).

In order to take full advantage of this package, make sure you have a [New Relic account](https://newrelic.com) before starting. Available features, such as slow transaction traces, will vary [based on account level](https://newrelic.com/application-monitoring/features).

As with any instrumentation tool, please test before using in production.

## Installation

To use New Relic's Node.js agent entails these three steps, which are described in detail below:

- Install [the `newrelic` package](https://www.npmjs.com/package/newrelic)
- Create a base configuration file
- Require the agent in your program

1. To install the agent for performance monitoring, use your favorite npm-based package manager and install the `newrelic` package into your application:

    `$ npm install newrelic`

2. Then, copy the stock configuration file to your program's base folder:

    `$ cp ./node_modules/newrelic/newrelic.js ./<your destination>`

3. Now, add your New Relic license key and application/service name to that file:

```js
    /* File: newrelic.js */
    'use strict'
    /**
     * New Relic agent configuration.
     *
     * See lib/config/default.js in the agent distribution for a more complete
     * description of configuration variables and their potential values.
     */
    exports.config = {
      app_name: ['Your application or service name'],
      license_key: 'your new relic license key',
      /* ... rest of configuration .. */
    }
```

4. Finally, load the `newrelic` module _before any other module_ in your program.

```js
    const newrelic = require('newrelic')

    /* ... the rest of your program ... */
```

If you're compiling your JavaScript and can't control the final `require` order, the Node,js agent will work with node's `-r/--require` flag.

    $ node -r newrelic your-program.js
    $ node --require newrelic your-program.js

## Getting Started

For more information on getting started, [check the Node.js docs](https://docs.newrelic.com/docs/agents/nodejs-agent/getting-started/introduction-new-relic-nodejs).

## Usage

### Using the API

The `newrelic` module returns an object with the Node agent's API methods attached.

```js
    const newrelic = require('newrelic')

    /* ... */
    newrelic.addCustomAttribute('some-attribute', 'some-value')
```

You can read more about using the API over on the [New Relic documentation](https://docs.newrelic.com/docs/agents/nodejs-agent/api-guides/guide-using-nodejs-agent-api) site.

## Testing

These are the steps to work on core agent features, with more detail below:

- Fork the agent
- Install its dependencies
- Run tests using `npm`

1. [Fork](https://github.com/newrelic/node-newrelic/fork) and clone this GitHub repository:

    $ git clone git@github.com:your-user-name/node-newrelic.git
    $ cd node-newrelic

2. Install the project's dependences:

    $ npm install

Then you're all set to start programming.

### To run the test suite

1. [Install Docker](https://www.docker.com/products/docker-desktop)
2. Start the Docker services: `$ npm run services`
3. Run all the tests using `$ npm run test`

Available test suites include:

    $ npm run unit
    $ npm run integration
    $ npm run versioned
    $ npm run lint
    $ npm run smoke

## Further Reading

Here are some resources for learning more about the agent:

- [New Relic's official Node.js agent documentation](https://docs.newrelic.com/docs/agents/nodejs-agent)

- [Developer docs](http://newrelic.github.io/node-newrelic/docs/)

- [Configuring the agent using `newrelic.js` or environment variables](https://docs.newrelic.com/docs/agents/nodejs-agent/installation-configuration/nodejs-agent-configuration)

- [Use the node agent to add the Browser and SPA monitoring](https://docs.newrelic.com/docs/agents/nodejs-agent/supported-features/new-relic-browser-nodejs-agent)

- [API transaction naming](https://docs.newrelic.com/docs/agents/nodejs-agent/api-guides/nodejs-agent-api#request-names) and [rules-based transaction naming](https://docs.newrelic.com/docs/agents/nodejs-agent/api-guides/nodejs-agent-api#ignoring)

- [Custom instrumentation/transactions](https://docs.newrelic.com/docs/agents/nodejs-agent/api-guides/guide-using-nodejs-agent-api#creating-transactions)

- [The changelog](https://github.com/newrelic/node-newrelic/blob/main/NEWS.md)

## Support

Should you need assistance with New Relic products, you are in good hands with several support channels.

If the issue has been confirmed as a bug or is a feature request, please file a GitHub issue.

**Support Channels**

* [New Relic Documentation](https://docs.newrelic.com/docs/agents/nodejs-agent/getting-started/introduction-new-relic-nodejs): Comprehensive guidance for using our platform
* [New Relic Community](https://discuss.newrelic.com/c/support-products-agents/node-js-agent/): The best place to engage in troubleshooting questions
* [New Relic Developer](https://developer.newrelic.com/): Resources for building a custom observability applications
* [New Relic University](https://learn.newrelic.com/): A range of online training for New Relic users of every level
* [New Relic Technical Support](https://support.newrelic.com/) 24/7/365 ticketed support. Read more about our [Technical Support Offerings](https://docs.newrelic.com/docs/licenses/license-information/general-usage-licenses/support-plan).


## Privacy
At New Relic we take your privacy and the security of your information seriously, and are committed to protecting your information. We must emphasize the importance of not sharing personal data in public forums, and ask all users to scrub logs and diagnostic information for sensitive information, whether personal, proprietary, or otherwise.

We define “Personal Data” as any information relating to an identified or identifiable individual, including, for example, your name, phone number, post code or zip code, Device ID, IP address and email address.

Please review [New Relic’s General Data Privacy Notice](https://newrelic.com/termsandconditions/privacy) for more information.

## Roadmap

See our [roadmap](./ROADMAP_Node.md), to learn more about our product vision, understand our plans, and provide us valuable feedback.

## Contribute

We encourage your contributions to improve the Node.js agent! Keep in mind when you submit your pull request, you'll need to sign the CLA via the click-through using CLA-Assistant. You only have to sign the CLA one time per project.

If you have any questions, or to execute our corporate CLA, required if your contribution is on behalf of a company,  please drop us an email at opensource@newrelic.com.

**A note about vulnerabilities**

As noted in our [security policy](../../security/policy), New Relic is committed to the privacy and security of our customers and their data. We believe that providing coordinated disclosure by security researchers and engaging with the security community are important means to achieve our security goals.

If you believe you have found a security vulnerability in this project or any of New Relic's products or websites, we welcome and greatly appreciate you reporting it to New Relic through [HackerOne](https://hackerone.com/newrelic).

If you would like to contribute to this project, review [these guidelines](./CONTRIBUTING.md).

To [all contributors](https://github.com/newrelic/node-newrelic/graphs/contributors), we thank you!  Without your contribution, this project would not be what it is today.  We also host a community project page dedicated to [New Relic Node Agent](https://opensource.newrelic.com/projects/newrelic/node-newrelic).

## License

The Node.js agent is licensed under the [Apache 2.0](http://apache.org/licenses/LICENSE-2.0.txt) License.

The Node.js agent also uses source code from third-party libraries. You can find full details on which libraries are used and the terms under which they are licensed in [the third-party notices document](https://github.com/newrelic/node-newrelic/blob/main/THIRD_PARTY_NOTICES.md).


[1]: https://nodei.co/npm/newrelic.png
[2]: https://nodei.co/npm/newrelic
[3]: https://github.com/newrelic/node-newrelic/workflows/Server%20Smoke%20Tests/badge.svg
[4]: https://github.com/newrelic/node-newrelic/actions?query=workflow%3A%22Server+Smoke+Tests%22
[5]: https://github.com/newrelic/node-newrelic/workflows/Node%20Agent%20CI/badge.svg
[6]: https://github.com/newrelic/node-newrelic/actions?query=workflow%3A%22Node+Agent+CI%22
