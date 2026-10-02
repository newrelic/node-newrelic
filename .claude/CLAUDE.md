# newrelic instrumentation agent

`newrelic` is an observability instrumentation agent. It hooks and traces
third party modules.

## Conventions
- Code style is enforced using eslint and should be written according to its configuration
- Tests are written using the `node:test` module
- Create new source files without a copyright preamble, then run `npm run lint:fix`
to insert it. Do not hand-write the header: the `@newrelic/eslint-config` header rule
only adds a missing header (stamping the current year) and will not correct an
existing one, so a handwritten header with the wrong year won't be fixed

## Important
- Unit tests live in `test/unit/`
- When verifying new unit tests, run the test directly as `node --test <test_file>`
- Agent integration tests live in `test/integration/` and verify agent
specific functionality
- Instrumentation of third party modules is verified by "versioned tests"
- Versioned tests live in `test/versioned/`
- Docker services should be running for versioned tests to succeed
- After running a specific versioned test suite at least once, individual
test files in the suite may be run directly as
`node --test test/versioned/<suite>/<test_file>`
- When opening Pull Requests, always open them in draft mode
- Pull Request titles must use past tense (e.g. "Refactored foo" not "Refactor foo")
- Pull Request titles must follow the conventional commits convention

## Commands
npm run services:start # start Docker services
npm run services:stop # stop Docker services
npm run versioned:major # run all versioned tests
npm run versioned:major <suite_name> # run specific versioned test suite
npm run unit # run all unit tests
npm run lint # verify code style
npm run lint:verbose # show all code style errors
npm run lint:fix # automatically fix incorrect code style
