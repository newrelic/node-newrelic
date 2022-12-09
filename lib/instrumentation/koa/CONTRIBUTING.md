# Guidelines for Contributing Code

New Relic welcomes code contributions by the Node community to this module, and
have taken effort to make this process easy for both contributors and our
development team.

## Process

### Feature Requests

Feature requests should be submitted in the [Issue tracker](../../issues), with
a description of the expected behavior & use case. Before submitting an Issue,
please search for similar ones in the [closed
issues](../../issues?q=is%3Aissue+is%3Aclosed+label%3Aenhancement).

### Pull Requests

We can only accept PRs for version v4.0.0 or greater due to open source
licensing restrictions.

### Code of Conduct

Before contributing please read the [code of conduct](./CODE_OF_CONDUCT.md)

Note that our [code of conduct](./CODE_OF_CONDUCT.md) applies to all platforms
and venues related to this project; please follow it in all your interactions
with the project and its participants.

### Contributor License Agreement

Keep in mind that when you submit your Pull Request, you'll need to sign the
CLA via the click-through using CLA-Assistant. If you'd like to execute our
corporate CLA, or if you have any questions, please drop us an email at
opensource@newrelic.com.

For more information about CLAs, please check out Alex Russell’s excellent
post, [“Why Do I Need to Sign
This?”](https://infrequently.org/2008/06/why-do-i-need-to-sign-this/).

### Slack

We host a public Slack with a dedicated channel for contributors and
maintainers of open source projects hosted by New Relic. If you are
contributing to this project, you're welcome to request access to the
\#oss-contributors channel in the newrelicusers.slack.com workspace. To request access, please use this [link](https://join.slack.com/t/newrelicusers/shared_invite/zt-1ayj69rzm-~go~Eo1whIQGYnu3qi15ng).

## PR Guidelines

### Version Support

When contributing, keep in mind that New Relic customers (that's you!) are running many different versions of Node, some of them pretty old. Changes that depend on the newest version of Node will probably be rejected, especially if they replace something backwards compatible.

Be aware that the instrumentation needs to work with a wide range of versions of the instrumented modules, and that code that looks nonsensical or overcomplicated may be that way for compatibility-related reasons. Read all the comments and check the related tests before deciding whether existing code is incorrect.

If you’re planning on contributing a new feature or an otherwise complex contribution, we kindly ask you to start a conversation with the maintainer team by opening up an Github issue first. 

### General Guidelines

In general, we try to limit adding third-party production dependencies. If one is necessary, please be prepared to make a clear case for the need.

### Coding Style Guidelines/Conventions

We use eslint to enforce certain coding standards. Please see our [.eslintrc](./.eslintrc.js) file for specific rule configuration.

### Testing Guidelines

The koa instrumentation module includes a suite of unit and functional tests which should be used to
verify your changes don't break existing functionality.

Unit tests are stored in `tests/`. They're written in
[node-tap](https://github.com/isaacs/node-tap), and have the extension `.tap.js`.

Functional tests against specific versions of instrumented modules are stored
in `test/versioned/`. They are also written in `node-tap`.

#### Running Tests

Running the test suite is simple. Just run:

    npm test

This will install all the necessary modules and run the unit tests in standalone mode, followed by
the functional tests if all of the unit tests pass.

To just run unit tests, run the following:

    npm run unit

#### Writing Tests

For most contributions it is strongly recommended to add additional tests which
exercise your changes. This helps us efficiently incorporate your changes into
our mainline codebase and provides a safeguard that your change won't be broken
by future development. Because of this, we require that all changes come with
tests. You are welcome to submit pull requests with untested changes, but they
won't be merged until you or the development team have an opportunity to write
tests for them.

There are some rare cases where code changes do not result in changed
functionality (e.g. a performance optimization) and new tests are not required.
In general, including tests with your pull request dramatically increases the
chances it will be accepted.
