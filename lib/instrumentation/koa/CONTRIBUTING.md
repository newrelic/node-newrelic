# Guidelines for contributing code

New Relic welcomes code contributions by the Node community to this module, and
have taken effort to make this process easy for both contributors and our
development team.

When contributing, keep in mind that New Relic customers (that's you!) are
running many different versions of Node, some of them pretty old. Changes that
depend on the newest version of Node will probably be rejected, with prejudice
if they replace something backwards compatible.

## Testing

The module includes a suite of unit and functional tests which should be used to
verify your changes don't break existing functionality.

All tests are stored in `tests/` and are written using
[Tap](https://www.npmjs.com/package/tap) with the extension `.tap.js`.

Running the test suite is simple.  Just run:

    npm test

### Writing tests

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

## And finally...

You are welcome to send pull requests to us - however, by doing so you agree
that you are granting New Relic a non-exclusive, non-revokable, no-cost license
to use the code, algorithms, patents, and ideas in that code in our products if
we so choose. You also agree the code is provided as-is and you provide no
warranties as to its fitness or correctness for any purpose.
