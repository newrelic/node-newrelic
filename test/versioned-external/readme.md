# About versioned-external

Tests from external repositories can be configured to be run by the agent as a part of the normal versioned test runs. For repos defined in `external-repos.js`, the necessary test run code will get cloned into `TEMP_TESTS` and then run as a part of the standard `npm run versioned*` test runs. These repos are cloned using sparse-checkout to attempt to reduce the amount of data pulled each time.

To add runs against an external repo update `external-repos.js` with the necessary details.

`name`: folder name to checkout the repo into.
`repository`: repo URL to clone from.
`branch`: branch to checkout
`additionalFiles`: String array of files/folders to checkout in addition to `lib` and `tests/versioned`.


`lib` and `tests/versioned` folders will always be checked-out from the specified repository. In some cases, you may need additional files if they are stored in a central sharing location across multiple test run times. For example, apollo-server-plugin may also need `tests/data-definitions.js`, etc. In these cases, leverage the `additionalFiles` property.
