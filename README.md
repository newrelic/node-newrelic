<a href="https://opensource.newrelic.com/oss-category/#community-plus"><picture><source media="(prefers-color-scheme: dark)" srcset="https://github.com/newrelic/opensource-website/raw/main/src/images/categories/dark/Community_Plus.png"><source media="(prefers-color-scheme: light)" srcset="https://github.com/newrelic/opensource-website/raw/main/src/images/categories/Community_Plus.png"><img alt="New Relic Open Source community plus project banner." src="https://github.com/newrelic/opensource-website/raw/main/src/images/categories/Community_Plus.png"></picture></a>

# New Relic's Node.js agent
[![npm status badge][1]][2] [![Server Smoke Tests][3]][4] [![Node Agent CI][5]][6] [![codecov][7]][8]

This package instruments your application for performance monitoring with [New Relic](https://newrelic.com).

In order to take full advantage of this package, make sure you have a [New Relic account](https://newrelic.com) before starting. Available features, such as slow transaction traces, will vary [based on account level](https://newrelic.com/application-monitoring/features).

As with any instrumentation tool, please test before using in production.

## Installation

To use New Relic's Node.js agent entails these three steps, which are described in detail below:

- Install [the `newrelic` package](https://www.npmjs.com/package/newrelic)
- Create a base configuration file
- Require the agent in your program

1. To install the agent for performance monitoring, use your favorite npm-based package manager and install the `newrelic` package into your application:

    ```sh
    $ npm install newrelic
    ```

2. Then, copy the stock configuration file to your program's base folder:

    ```sh
    $ cp ./node_modules/newrelic/newrelic.js ./<your destination>
    ```

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

4. Finally, run your program with the `newrelic` module loaded first by using node's `-r/--require` flag.

```
 $ node -r newrelic your-program.js
```

If you cannot control how your program is run, you can load the `newrelic` module _before any other module_ in your program.

```js
    const newrelic = require('newrelic')

    /* ... the rest of your program ... */
```

## ECMAScript Modules

If your application is written with `import` and `export` statements in javascript, you are using [ES Modules](https://nodejs.org/api/esm.html#modules-ecmascript-modules) and must bootstrap the agent in a different way.

The New Relic Node.js agent includes ***_experimental_*** support for ES Modules. The agent is reliant on an experimental feature in Node.js in order to appropriately register instrumentation. Until the Node.js API for [ES Module Loaders](https://nodejs.org/api/esm.html#loaders) is stable, breaking changes may occur when updating Node.js. Lastly, the ESM loader does not follow the same [supported Node.js versions](https://docs.newrelic.com/docs/apm/agents/nodejs-agent/getting-started/compatibility-requirements-nodejs-agent#system) as the agent. The minimum supported version of Node.js is `v16.12.0`.

### Setup

 1. If you rely on a configuration file to run the agent, you must rename the file from `newrelic.js` to `newrelic.cjs` so it can be properly loaded.  All the contents of the configuration file will behave the same once you rename. See [CommonJS modules in ESM](https://nodejs.org/api/modules.html#enabling) for more details.

```sh
$ mv newrelic.js newrelic.cjs
```

 2. To use the newrelic ESM loader, start your program with node and use the `--experimental-loader` flag and a path to the loader file, like this:

```sh
$ node --experimental-loader newrelic/esm-loader.mjs -r newrelic your-program.js
```

**Note**: Unlike the CommonJS methods listed above, there are no alternatives to running the agent without the `--experimental-loader` flag.

### Custom Instrumentation

The agent supports adding your own custom instrumentation to ES module applications. You can use the instrumentation API methods. The only other difference between CommonJS custom instrumentation and ESM is you must provide a property of `isEsm: true`. 

```js
import newrelic from 'newrelic'
newrelic.instrument({ moduleName: 'parse-json', isEsm: true }, function wrap(shim, parseJson, moduleName) {
  shim.wrap(parseJson.default, function wrapParseJson(shim, orig) {
      return function wrappedParseJson() {
          const result = orig.apply(this, arguments)
          result.instrumented = true
          return true
      }
  })
})
```

We support the following custom instrumentation API methods in ES module apps:

* `newrelic.instrument`
* `newrelic.instrumentConglomerate`
* `newrelic.instrumentDatastore`
* `newrelic.instrumentMessages`
* `newrelic.instrumentWebframework`

Note that we _do not_ support `newrelic.instrumentLoadedModule`, for the same issue of immutability mentioned above.

If you want to see an example of how to write custom instrumentation in an ES module app, check out our [examples](https://github.com/newrelic/newrelic-node-examples/tree/main/esm-app) repo for a working demo.

## Getting Started

For more information on getting started, [check the Node.js docs](https://docs.newrelic.com/docs/agents/nodejs-agent/getting-started/introduction-new-relic-nodejs).

### External Modules

There are several modules that can be installed and configured to accompany the Node.js agent:

 * [@newrelic/apollo-server-plugin](https://github.com/newrelic/newrelic-node-apollo-server-plugin): New Relic's official Apollo Server plugin for use with the Node.js agent.
 * [@newrelic/next](https://github.com/newrelic/newrelic-node-nextjs): Provides instrumentation for the [Next.js](https://github.com/vercel/next.js/) npm package.

There are several modules included within the Node.js agent to add more instrumentation for 3rd party modules:

 * [@newrelic/aws-sdk](https://github.com/newrelic/node-newrelic-aws-sdk):  Provides instrumentation for the [AWS SDK](https://www.npmjs.com/package/aws-sdk) npm package.
 * [@newrelic/koa](https://github.com/newrelic/node-newrelic-koa): Provides instrumentation for [koa](https://koajs.com/), [koa-router](https://github.com/ZijianHe/koa-router), [@koa/router](https://github.com/koajs/router), and [koa-route](https://github.com/koajs/route) npm packages.
 * [@newrelic/superagent](https://github.com/newrelic/node-newrelic-superagent): Provides instrumentation for [superagent](https://github.com/visionmedia/superagent) npm package.
 * [@newrelic/native-metrics](https://github.com/newrelic/node-native-metrics): Provides hooks into the native v8 layer of Node.js to provide metrics to the Node.js agent.

## Usage

### Using the API

The `newrelic` module returns an object with the Node.js agent's API methods attached.

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

2. Install the project's dependencies:

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

- [Developer docs](https://newrelic.github.io/node-newrelic/)

- [Configuring the agent using `newrelic.js` or environment variables](https://docs.newrelic.com/docs/agents/nodejs-agent/installation-configuration/nodejs-agent-configuration)

- [Use the node agent to add the Browser and SPA monitoring](https://docs.newrelic.com/docs/agents/nodejs-agent/supported-features/new-relic-browser-nodejs-agent)

- [API transaction naming](https://docs.newrelic.com/docs/agents/nodejs-agent/api-guides/nodejs-agent-api#request-names) and [rules-based transaction naming](https://docs.newrelic.com/docs/agents/nodejs-agent/api-guides/nodejs-agent-api#ignoring)

- [Custom instrumentation/transactions](https://docs.newrelic.com/docs/agents/nodejs-agent/api-guides/guide-using-nodejs-agent-api#creating-transactions)

- [The changelog](https://github.com/newrelic/node-newrelic/blob/main/NEWS.md)

- [Example applications](https://github.com/newrelic/newrelic-node-examples) - Working examples of New Relic features in Node.js.

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

The Node.js agent is licensed under the [Apache 2.0](https://apache.org/licenses/LICENSE-2.0.txt) License.

The Node.js agent also uses source code from third-party libraries. You can find full details on which libraries are used and the terms under which they are licensed in [the third-party notices document](https://github.com/newrelic/node-newrelic/blob/main/THIRD_PARTY_NOTICES.md).


[1]: https://img.shields.io/npm/v/newrelic.svg
[2]: https://www.npmjs.com/package/newrelic
[3]: https://github.com/newrelic/node-newrelic/workflows/Server%20Smoke%20Tests/badge.svg
[4]: https://github.com/newrelic/node-newrelic/actions?query=workflow%3A%22Server+Smoke+Tests%22
[5]: https://github.com/newrelic/node-newrelic/workflows/Node%20Agent%20CI/badge.svg
[6]: https://github.com/newrelic/node-newrelic/actions?query=workflow%3A%22Node+Agent+CI%22
[7]: https://codecov.io/gh/newrelic/node-newrelic/branch/main/graph/badge.svg
[8]: https://codecov.io/gh/newrelic/node-newrelic

