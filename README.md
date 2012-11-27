# New Relic Node.js agent

Make sure you have a New Relic account before starting. Until the end of the
beta, you'll want to have access to Pro features like slow transaction traces.
Contact your New Relic representative to see about getting a trial upgrade for
the purposes of testing.

## Getting started

1. [Install node](http://nodejs.org/#download). For now, at least 0.6 is
   required. Development work is being done against the latest released
   version.
2. Install this module via `npm install newrelic` for the application you
   want to monitor.
3. Copy `newrelic.js` from `node_modules/newrelic` into the root directory of
   your application.
4. Edit `newrelic.js` and replace `license_key`'s value with the license key
   for your account.
5. Add `require('newrelic');` as the first line of the app's main module.
   *IMPORTANT*: formerly this was `require('newrelic_agent')`, and you *MUST*
	 update your code.

When you start your app, the agent should start up with it and start reporting
data that will appear within our UI after a few minutes. Because the agent
minimizes the amount of bandwidth it consumes, it only reports metrics, errors
and transaction traces once a minute, so if you add the agent to tests that run
in under a minute, the agent won't have time to report data to New Relic. The
agent will write its log to a file named `newrelic_agent.log` in the
application directory. If the agent doesn't send data or crashes your app, the
log can help New Relic determine what went wrong, so be sure to send it along
with any bug reports or support requests.

## Running tests

The agent's unit tests use [mocha](http://visionmedia.github.com/mocha/). Its
integration tests use [node-tap](http://github.com/isaacs/node-tap/). If you
want to run them yourself, they can be run via `npm test`, except on Windows.
Work on a Windows solution is forthcoming.

If you encounter any test failures, please contact New Relic support or the
beta list, and be sure to include whatever information you can about how you're
running Node and what the test suite returned.

## Recent changes

Information about changes to the agent are in NEWS.md.

## Known issues & remaining work

Information about what's known to be broken and what's being worked on
soon is in TODO.md.

## LICENSE

The New Relic Node.js agent is free-to-use, proprietary software. Please see
the [full license](LICENSE) for details.
