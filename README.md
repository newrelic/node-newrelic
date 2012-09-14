# New Relic Node.js agent

Make sure you have a New Relic account before starting. Until the end of the
beta, you'll want to have access to Pro features like slow transaction traces.
Contact your New Relic representative to see about getting a trial upgrade for
the purposes of testing.

## Getting started

1. [Install node](http://nodejs.org/#download). For now, at least 0.8.0 is
   required. Development work is being done against the latest version.
2. Put this directory under the node_modules directory for the application
   you want to instrument.
3. Run `npm install` to pull down the agent's dependencies.
4. If you want to instrument multiple applications, unpack the distribution
   into a directory and run `npm link` from the root of the distribution.
   From then, to use the agent in your apps, just run
   `npm link newrelic_agent` from the root of the application to be
   instrumented (after running `npm install`).
5. Copy `newrelic.js` from the agent directory into the root directory of
   your application.
6. Edit `newrelic.js` and replace `license_key`'s value with the license key
   for your account.
7. Add `require('newrelic_agent');` as the first line of the app's main module.

When you start your app, the agent should start up with it and start reporting
data that will appear within our UI after a few minutes. The agent will write
its log to a file named `newrelic_agent.log` in the application directory. If
the agent doesn't send data that file might provide insight into the problem.

## Running tests

The agent's unit tests are written in
[mocha](http://visionmedia.github.com/mocha/), and can be run via
`npm test`.

If you encounter any test failures, please contact New Relic support, and
be sure to include whatever information you can about how you're running
Node and what the test suite returned.

## Recent changes

Information about changes to the agent are in the [NEWS file](NEWS.md).

## Known issues & remaining work

Information about what's known to be broken and what's being worked on
soon is in the [TODO file](TODO.md).

## LICENSE

The New Relic Node.js is free-to-use, proprietary software. please see
the [full license](LICENSE) for details.
