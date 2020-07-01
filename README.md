[![Community Project header](https://github.com/newrelic/opensource-website/raw/master/src/images/categories/Community_Project.png)](https://opensource.newrelic.com/oss-category/#community-project)

# New Relic's NodeJS Agent

[![npm status badge][1]][2]

This package instruments your application for performance monitoring with [New Relic](https://newrelic.com).

In order to take full advantage of this package, make sure you have a [New Relic account](https://newrelic.com) before starting. Available features, such as slow transaction traces, will vary [based on account level](https://newrelic.com/application-monitoring/features).

As with any instrumentation tool, please test before using in production.

## Installation and Getting Started

To use New Relic's NodeJS agent, you'll need to

1. Install [the `newrelic` package](https://www.npmjs.com/package/newrelic)
2. Create a base configuration file
3. Require the agent in your program

To install the agent for performance monitoring, use your favorite NPM based package manager to install the `newrelic` package into your application

    $ npm install newrelic

Then, copy the stock configuration file to your program's base folder, and add your New Relic license key and application/service name.

    $ cp node_modules/newrelic/newrelic.js

    # File: newrelic.js
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

Finally, load the `newrelic` module _before any other module_ in your program.

    const newrelic = require('newrelic')

    /* ... the rest of your program ... */

If you are compiling your javascript and can't control the final `require` order, the NodeJS agent will work with node's `-r/--require` flag.

    $ node -r newrelic your-program.js
    $ node --require newrelic your-program.js

For more information on getting started, [check the official docs](https://docs.newrelic.com/docs/agents/nodejs-agent/getting-started/introduction-new-relic-nodejs).

## Using the API

The `newrelic` module returns an object with the Node Agent's API methods attached.

    const newrelic = require('newrelic')

    /* ... */
    newrelic.addCustomAttribute('some-attribute', 'some-value')

You can read more about using the API over on the [New Relic Documentation](https://docs.newrelic.com/docs/agents/nodejs-agent/api-guides/guide-using-nodejs-agent-api) site.

## Core Agent Development and Tests

To work on core agent features, you'll want to

1. Fork the Agent
2. Install its Dependencies
3. Run tests via `npm`

[Fork](https://github.com/newrelic/node-newrelic/fork) and clone this GitHub repository

    $ git clone git@github.com:your-user-name/node-newrelic.git
    $ cd node-newrelic

Install the project's dependences

    $ npm install

and you'll be all set to start programming.

To run the test suite

1. Install [install Docker](https://www.docker.com/products/docker-desktop)
2. Start the docker services: `$ npm run services`
3. Run all the tests via `$ npm run test`

Available test suites include

    $ npm run unit
    $ npm run integration
    $ npm run versioned
    $ npm run lint
    $ npm run smoke

## Further Reading

Here's some resources for learning more about the Agent

- [New Relic's official NodeJS Agent Documentation](https://docs.newrelic.com/docs/agents/nodejs-agent)

- [Developer Docs](http://newrelic.github.io/node-newrelic/docs/)

- [Configuring the Agent (via `newrelic.js` or environment variables)](https://docs.newrelic.com/docs/agents/nodejs-agent/installation-configuration/nodejs-agent-configuration)

- [Use the Node Agent to add the Browser and SPA Monitoring](https://docs.newrelic.com/docs/agents/nodejs-agent/supported-features/new-relic-browser-nodejs-agent)

- [API Transaction Naming](https://docs.newrelic.com/docs/agents/nodejs-agent/api-guides/nodejs-agent-api#request-names) and [Rules Based Transaction Naming](https://docs.newrelic.com/docs/agents/nodejs-agent/api-guides/nodejs-agent-api#ignoring)

- [Custom Instrumentation/Transactions](https://docs.newrelic.com/docs/agents/nodejs-agent/api-guides/guide-using-nodejs-agent-api#creating-transactions)

- [The Changelog](/node-newrelic/blob/main/NEWS.md)

## Support

New Relic hosts and moderates an online forum where customers can interact with New Relic employees as well as other customers to get help and share best practices. Like all official New Relic open source projects, there's a related Community topic in the New Relic Explorers Hub. You can find this project's topic/threads here:

https://discuss.newrelic.com/c/support-products-agents/node-js-agent/

## Contributing

We encourage your contributions to improve the NodeJS Agent. Keep in mind when you submit your pull request, you'll need to sign the CLA via the click-through using CLA-Assistant.

You only have to sign the CLA one time per project.

If you have any questions or need to execute our corporate CLA, (required if your contribution is on behalf of a company),  please drop us an email at opensource@newrelic.com.

## License

The NodeJS Agent is licensed under the [Apache 2.0](http://apache.org/licenses/LICENSE-2.0.txt) License.

The NodeJS Agent also uses source code from third-party libraries. You can find full details on which libraries are used and the terms under which they are licensed in [the third-party notices document](/node-newrelic/blob/main/THIRD_PARTY_NOTICES.md).


[1]: https://nodei.co/npm/newrelic.png
[2]: https://nodei.co/npm/newrelic
