# Guidelines for contributing code

New Relic welcomes code contributions by the Node community to this module, and
have taken effort to make this process easy for both contributors and our
development team.

When contributing, keep in mind that New Relic customers (that's you!) are
running many different versions of Node, some of them pretty old (most of you
have moved off 0.6, but there are more than a few 0.8 applications still out
there). Changes that depend on the newest version of Node will probably be
rejected, with prejudice if they replace something backwards compatible.

Also be aware that the instrumentation needs to work with a wide range of
versions of the instrumented modules, and that code that looks nonsensical or
overcomplicated may be that way for compatibility-related reasons. Read all the
comments and check the related tests before deciding whether existing code is
incorrect.

## Testing

The agent includes a suite of unit and functional tests which should be used to
verify your changes don't break existing functionality.

Unit tests are stored in `test/`. They're written in
[Mocha](http://visionmedia.github.io/mocha/), and have the extension
`.test.js`.

Generic functional tests are stored in `test/integration/`. They're written in
[node-tap](https://github.com/isaacs/node-tap), and have the extension
`.tap.js`.

Functional tests against specific versions of instrumented modules are stored in
`test/versioned/`. They are also written in `node-tap`.

There are some other tests in `test/multiverse/` and `test/versioned-node/`.
They are works in progress and not ready for general-purpose use.

### Running tests

To run the functional tests, you will need to have servers for MongoDB, Redis,
MySQL, and memcached installed on the machine where you run the tests. You will
also need the openssl command-line binary and a GNU-compatible make. Please
read the documentation for your distribution or packaging system for details on
how to install the correct packages. Be aware that the binaries are run
directly by the agent, so network access on the same network isn't going to be
sufficient. Also, if you get everything up and running on Windows, please send
us a pull request with the details and we'll incorporate it into this document.

Running the test suite is simple.  Just run:

    npm test

This will install all the necessary modules (and do any required SSL certificate
creation) and run the unit tests in standalone mode, followed by the functional
tests if all of the unit tests pass.

If you don't feel like dealing with the hassle of installing the servers, just
the unit tests can be run with:

    make unit

### Writing tests

For most contributions it is strongly recommended to add additional tests which
exercise your changes.

This helps us efficiently incorporate your changes into our mainline codebase
and provides a safeguard that your change won't be broken by future development.

There are some rare cases where code changes do not result in changed
functionality (e.g. a performance optimization) and new tests are not required.
In general, including tests with your pull request dramatically increases the
chances it will be accepted.

## And finally...

You are welcome to send pull requests to us - however, by doing so you agree
that you are granting New Relic a non-exclusive, non-revokable, no-cost license
to use the code, algorithms, patents, and ideas in that code in our products if
we so choose. You also agree the code is provided as-is and you provide no
warranties as to its fitness or correctness for any purpose.
