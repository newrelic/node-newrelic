# newrelic instrumentation agent

`newrelic` is an observability instrumentation agent. It hooks and traces
third party modules.

## Conventions
- Code style is enforced using eslint and should be written according to its configuration
- Tests are written using the `node:test` module

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

## Commands
npm run services:start # start Docker services
npm run services:stop # stop Docker services
npm run versioned:major # run all versioned tests
npm run versioned:major <suite_name> # run specific versioned test suite
npm run unit # run all unit tests
npm run lint # verify code style
npm run lint:verbose # show all code style errors
npm run lint:fix # automatically fix incorrect code style
