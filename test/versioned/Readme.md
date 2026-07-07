# Versioned Tests

The subdirectories within this directory represent test suites that verify
our agent compatibility across multiple versions of our supported modules.
When these tests are run, through our versioned test runner tool, each suite
is run multiple times utilizing different versions of the module that satisfy
configured version constraints.

For example, if a supported module has releases `1.0.0` through `1.10.0`, with
a version for each minor between `0` and `10`, then our versioned test runner
will run the test suite across a sampling of versions in that range, e.g.
versions `1.0.0`, `1.3.0`, and `1.10.0`.

## Versioned Tests `npm-env.json`
We have a few npm config options in `node-newrelic/.npmrc`. These options are intended
to harden our security posture, however they may conflict with how our versioned test runner
operates.  In `bin/verisoned-runnner.js` we pass a cli arg of `--min-release-age=0` to allow
us to test the latest versions of packages.  For packages that have to build as part of a postinstall
step, you must provide a `npm-env.json` file with the following fields:

```json
{
  "NPM_CONFIG_IGNORE_SCRIPTS": false
}
```

This will be used to set the values as env vars when running a given test suite. In the future, 
if the are other npm config options that need overriden, they follow the convention of `NPM_CONFIG_<npm config option in upper case>=<value>``

## Versioned Tests `package.json`

The versioned test runner reads a `package.json` in each test suite. This
`package.json` describes the constraints for the suite and has a few properties
that are specific to our versioned test runner. The following is a
[jsonc](https://en.wikipedia.org/wiki/JSON#JSONC) representation of such a
`package.json` that describes the unique properties:

```jsonc
{
  // `name` is typically ignored.
  "name": "module-tests",
  
  // `targets` indicates which modules are being verified by the test suite.
  // This is utilized by tooling to build a compatibility document. There _must_
  // be at least one value that matches a dependency name in a subsequent
  // `tests` block. If this suite is verifying the compatibility of multiple
  // modules, include all such module names in the array.
  //
  // If this property is omitted, the tool used to build our compatibility
  // document(s) will not include any modules from this versioned test suite.
  "targets": [
    {
      // The name of the module being tested for compatibility.
      "name": "module",
      
      // The minimum agent version that supports the named module.
      "minAgentVersion": "2.6.0",
      
      // The minimum version of the package that the agent supports.
      // If this is omitted, it will be calculated from the version ranges
      // defined in the `tests` block.
      "minSupported": "1.0.0"
    },
    
    {
      "name": "other-module",
      
      // If the named module requires a specific agent implementation, for
      // example `@newrelic/next`, then the full agent module identifier with
      // version string should be provided.
      "minAgentVersion": "@newrelic/special-agent@1.2.3"
    }
  ],
  
  // `dockerServices` lists the docker-compose services (by their service name
  // in the repo-root `docker-compose.yml`) that this suite needs in order to
  // run. CI uses this to start only the required services for a given batch of
  // suites, and to skip starting docker entirely for suites that need none.
  //
  // Omit this property (or use an empty array) when the suite needs no backing
  // service -- e.g. pure HTTP frameworks, or SDKs whose backend is mocked.
  // List every service the suite connects to, including ones reached through a
  // helper imported from a sibling suite. Under-declaring will cause the suite
  // to fail in CI because the service it expects will not be running; an
  // unknown service name fails the shard-planning step. Some examples:
  //   - `kafkajs` needs both `kafka` and `zookeeper`.
  //   - `prisma` needs `pg_prisma` (a dedicated postgres), not `pg`.
  "dockerServices": ["service-name"],

  // `version` is ignored.
  "version": "0.0.0",
  
  // `private` should be set to `true`.
  "private": true,
  
  // `tests` contains blocks that describe the tests the versioned test runner
  // should run for this suite and under what constraints. Each block will
  // result in at least one test run by the test runner.
  "tests": [
    {
      // `engines` is a typical package.json engines block.
      "engines": {
        // `node` indicates which versions of Node.js should be used to run
        // this test block. Typically, a basic `>=` qualifier will be used, but
        // a static version is also likely. If the version of Node.js being
        // used to run the suite does not match the constraint, then the test
        // block will be skipped.
        "node": ">=22"
      },
      
      // `dependencies` lists dependencies that a needed in order to execute
      // the test block. In most cases, only the module under test will be
      // present.
      "dependencies": {
        // For the dependency named "module-name", run the suite with samples
        // from the provided semver range (https://docs.npmjs.com/cli/v6/using-npm/semver#advanced-range-syntax).
        //
        // The minimum version across all test blocks will be utilized to
        // indicate the minimum supported version of a module by our agent
        // if that module name is listed in the top-level `targets` property.
        // If a defined target has a `minSupported` attribute defined, that
        // value will take precedence (i.e. the minimum supported version will
        // not be calculated).
        //
        // Note: this may also be an object with a special format. See the next
        // example block.
        "module-name": ">=1.0.0 <2.0.0"
      },
      
      // `files` lists out the test files that comprise the test suite for the
      // current block.
      "files": [
        "test-one.test.js",
        "test-two.test.js"
      ]
    },
    
    // This example block will only run on Node.js 22.x. Pay attention
    // to the "dependencies" section for a special dependency declaration
    // supported by our versioned test runner.
    {
      "engines": { "node": "22" },
      "dependencies": {
        "module-name": {
          // Again, a standard semver range to indicate the versions of the
          // module to sample from.
          "versions": ">=1.0.0 <2.0.0",
          
          // How many samples, across the provided versions range, to conduct
          // when testing with this test block. It should be a string value,
          // although some of our tooling will likely coerce it to an integer.
          "samples": "2"
        }
      },
      "files": [
        "test-one.test.js"
      ]
    },

    // This example block will run a set of dependencies on the same version.
    // This is intended to be used with packages from monorepos where there are
    // peer deps that require to be on the same version.
    {
      "engines": {
        "node": ">=22"
      },
      "groupedDependencies": {
        "version": ">=7.0.0",
        "packages": ["prisma", "@prisma/client", "@prisma/adapter-pg"]
      },
      "files": [
        "prisma-7plus.test.js"
      ]
    }
  ]
}
```
