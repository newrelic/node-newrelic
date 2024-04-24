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
      "minAgentVersion": "2.6.0"
    },
    
    {
      "name": "other-module",
      
      // If the named module requires a specific agent implemenation, for
      // example `@newrelic/next`, then the full agent module identifier with
      // version string should be provided.
      "minAgentVersion": "@newrelic/special-agent@1.2.3"
    }
  ],
  
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
        // used to run the suite does not match the contraint, then the test
        // block will be skipped.
        "node": ">= 18"
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
        //
        // Note: this may also be an object with a special format. See the next
        // example block.
        "module-name": ">=1.0.0 <2.0.0"
      },
      
      // `files` lists out the test files that comprise the test suite for the
      // current block.
      "files": [
        "test-one.tap.js",
        "test-two.tap.js"
      ]
    },
    
    // This example block will only run on Node.js 20.x. Pay attention
    // to the "dependencies" section for a special depedency declaration
    // supported by our versioned test runner.
    {
      "engines": { "node": "20" },
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
      }
    }
  ]
}
```
