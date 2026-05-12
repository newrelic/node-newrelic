/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const semver = require('semver')

/**
 * @interface TestDescriptor
 * @private
 *
 * @description
 *  Describes all of the tests to be executed and the required dependencies.
 *
 * @property {object} engines
 *  Mapping of engines (i.e. "node") to semver ranges.
 *
 * @property {object} dependencies
 *  Mapping of package names (i.e. "redis") to semver ranges.
 *
 * @property {Array.<string>} files
 *  Array of file names identifying tests to execute.
 */

/**
 * @interface PackageVersions
 * @private
 *
 * @description
 *  Maps package names to all known versions of that package.
 */

/**
 * Resolves the matching versions for one or more packages that should iterate
 * together. All packages share the same version range; when multiple names are
 * provided they install at the same version on each iteration (the intersection
 * of their matching versions is used).
 *
 * @param {Array.<string>} names Package names being resolved.
 * @param {string|object} wanted Declared version spec shared by every name —
 *   either a semver range string, `'latest'`, or `{ versions, samples }`.
 * @param {PackageVersions} pkgVersions pkg versions list
 * @param {number} globalSamples value of samples at runner
 * @returns {object} The iterator descriptor: `{ names, next, versions }`.
 */
function resolveIterator(names, wanted, pkgVersions, globalSamples) {
  let samples = Infinity
  let range = wanted
  if (typeof wanted === 'object') {
    samples = wanted.samples
    range = wanted.versions
  }

  let commonVersions = null
  for (const name of names) {
    const matching = pkgVersions[name].versions.filter((v) => (
      range === 'latest' ? pkgVersions[name].latest === v : semver.satisfies(v, range)
    ))

    commonVersions = commonVersions === null
      ? new Set(matching)
      : new Set(matching.filter((v) => commonVersions.has(v)))
  }

  let versions = [...commonVersions]

  /**
   * The package versions provided are just the most recent versions of the
   * packages according to our testing mode (i.e. major, minor, patch). If
   * none of the latest packages match, then an older version is requested
   * or a tag is used. Attempt to grab the package as-is.
   *
   * Failure to install later will result in failing the test, which is also
   * ideal VS a warn-only failure that passes CI.
   */
  if (versions.length === 0) {
    /* eslint-disable no-console */
    console.log(
      'No version match found. Attempting direct install of %s@%s',
      names.join(', '),
      range
    )
    /* eslint-enable no-console */
    versions = [range]
  }

  if (globalSamples) {
    samples = Math.min(globalSamples, samples)
  }

  if (samples != null && versions.length > samples) {
    // Since we take the latest version, we drop an intermediate version
    samples -= 1

    const sampled = []
    for (let i = 0; i < samples; i += 1) {
      sampled[i] = versions[Math.floor((versions.length * i) / samples)]
    }

    // Always take the latest
    sampled.push(versions[versions.length - 1])
    versions = sampled
  }

  return { names, next: 0, versions }
}

/**
 * Constructs a test matrix from the given test descriptor and package versions.
 *
 * @class
 * @private
 * @classdesc
 *  Provides an iteration class for stepping over every possible test
 *  combination described.
 *
 * @param {Array.<TestDescriptor>} tests
 *  Array of test descriptors for the whole range of things to be executed.
 *
 * @param {PackageVersions} pkgVersions
 *  All the package versions needed to flesh out the test descriptors.
 *
 * @param {number} globalSamples global override for samples
 */
function TestMatrix(tests, pkgVersions, globalSamples) {
  // The tests object is an array of objects pairing package version ranges with
  // an array of test files. These look like this:
  //  [
  //    {
  //      "engines": {"node": ">=22"}
  //      "dependencies": {"redis": "1.0.0"},
  //      "files": ["redis.test.js"]
  //    },
  //    {
  //      "engines": {"node": ">=22"}
  //      "dependencies": {
  //        "redis": {
  //          "versions": ">1.0.0 <2.0.0",
  //          "samples": 10
  //        }
  //      },
  //      "files": ["redis.test.js"]
  //    },
  //    {
  //      "engines": {"node": ">=22"},
  //      "groupedDependencies": {
  //        "version": ">=2.0.0",
  //        "packages": ["redis", "@redis/client"]
  //      },
  //      "files": "redis.test.js"
  //    }
  //  ]
  //
  // The pkgVersions object is a pairing of package names to arrays of versions
  // that look like this:
  //  {
  //    "bluebird": { "versions": ["1.0", "1.1", "1.2", "1.3"], "latest": "1.3"},
  //    "redis": { "versions": ["1.2", "1.3", "2.0"], "latest": "2.0" }
  //  }
  //
  // We want to convert the tests array into an array of objects with package
  // version iterators and a test file iterator. This should look something like
  // this:
  //  [{
  //    "packages": [{
  //      "names": ["redis"],         // <-- Package name(s). Multiple names means
  //                                  //     they install together at the same
  //                                  //     version (grouped dependency).
  //      "next": 0,                  // <-- Iteration point.
  //      "versions": [               // <-- List of versions to iterate through.
  //        "1.2", "1.3", "2.0"
  //      ]
  //    }],
  //    "tests": {
  //      "files": ["redis.test.js"],  // <-- List of test files to iterate through.
  //      "next": 0                   // <-- File iteration point.
  //    }
  //  }]
  this._matrix = tests
    ? tests.map((test) => {
      if (test.engines && !semver.satisfies(process.version, test.engines.node)) {
        return { tests: { files: [], next: 0 }, packages: [] }
      }

      const task = {
        tests: {
          files: test.files,
          next: 0
        },
        packages: []
      }

      if (test.dependencies) {
        for (const pkg of Object.keys(test.dependencies)) {
          task.packages.push(
            resolveIterator([pkg], test.dependencies[pkg], pkgVersions, globalSamples)
          )
        }
      }

      if (test.groupedDependencies && test.groupedDependencies.packages?.length) {
        const { packages, version } = test.groupedDependencies
        task.packages.push(
          resolveIterator(packages, version, pkgVersions, globalSamples)
        )
      }

      return task
    })
    : []

  this._matrixPos = 0
  this._length = null
}
Object.defineProperty(TestMatrix.prototype, 'versionsByPkg', {
  get: function versionsByPkg() {
    if (!this._versionsByPkg) {
      const versionMatrix = this._matrix.reduce((accum, tests) => {
        for (const pkg of tests.packages) {
          for (const name of pkg.names) {
            if (!Object.prototype.hasOwnProperty.call(accum, name)) {
              accum[name] = []
            }
            const versions = pkg.versions.filter((version) => !accum[name].includes(version))
            accum[name].push(...versions)
          }
        }
        return accum
      }, {})

      this._versionsByPkg = Object.entries(versionMatrix).map(
        ([key, versions]) => `${key}(${versions.length}): ${versions.join(', ')}`
      )
    }

    return this._versionsByPkg
  }
})

Object.defineProperty(TestMatrix.prototype, 'length', {
  get: function length() {
    if (this._length === null) {
      this._length = this._calculateLength()
    }
    return this._length
  }
})

/**
 * Peeks at the next test in the matrix without updating the matrix state.
 * @returns {null} returns no when no tests are left
 */
TestMatrix.prototype.peek = function peek() {
  // For each suite in the test matrix, for each combination of packages, for
  // each test file.
  for (let i = this._matrixPos; i < this._matrix.length; ++i) {
    let packages = null
    const task = this._matrix[i]

    if (!packages) {
      packages = this._peekPackages(task.packages)

      // If there are no more package combinations then this test suite is done
      // and we should move to the next one in the matrix.
      if (!packages) {
        continue
      }
    }

    do {
      const tests = task.tests
      if (tests.next < tests.files.length) {
        return {
          packages,
          test: tests.files[tests.next]
        }
      }

      tests.next = 0
      packages = this._peekPackages(task.packages)
    } while (packages)
  }

  // No tests left!
  return null
}

/**
 * Moves the matrix state to the next combination and returns it.
 * @returns {null} returns no when no tests are left
 */
TestMatrix.prototype.next = function next() {
  // For each suite in the test matrix, for each combination of packages, for
  // each test file.
  for (this._matrixPos; this._matrixPos < this._matrix.length; ++this._matrixPos) {
    const task = this._matrix[this._matrixPos]

    if (!this._packages) {
      this._packages = this._getNextPackages(task.packages)

      // If there are no more package combinations then this test suite is done
      // and we should move to the next one in the matrix.
      if (!this._packages) {
        continue
      }
    }

    do {
      const tests = task.tests
      if (tests.next < tests.files.length) {
        return {
          packages: this._packages,
          test: tests.files[tests.next++] // Yes, post-increment!
        }
      }

      tests.next = 0
      this._packages = this._getNextPackages(task.packages)
    } while (this._packages)
  }

  // No tests left!
  return null
}

TestMatrix.prototype._peekPackages = function _peekPackages(pkgs) {
  // If there are no packages associated with this test suite, return nothing.
  if (!pkgs || !pkgs.length) {
    return null
  }

  // With an array of task packages, we want to determine what the next run of
  // test should use for each of its packages.
  const nextPackages = {}
  let bumpNext = false
  for (let i = 0; i < pkgs.length; ++i) {
    const pkg = pkgs[i]
    let next = pkg.next
    if (bumpNext) {
      ++next
      bumpNext = false
    }
    if (next >= pkg.versions.length) {
      // If this package has looped through all its versions, increment the next
      // package's pointer and reset this one.
      if (i === pkgs.length - 1) {
        // If this is the last package and it has gone through all versions then
        // there is no "next" package set.
        return null
      }
      bumpNext = true
      next = 0
    }

    for (const name of pkg.names) {
      nextPackages[name] = pkg.versions[next]
    }
  }

  return nextPackages
}

TestMatrix.prototype._getNextPackages = function _getNextPackages(pkgs) {
  // If there are no packages associated with this test suite, return nothing.
  if (!pkgs || !pkgs.length) {
    return null
  }

  // With an array of task packages, we want to determine what the next run of
  // test should use for each of its packages.
  const nextPackages = {}
  for (let i = 0; i < pkgs.length; ++i) {
    const pkg = pkgs[i]
    if (pkg.next >= pkg.versions.length) {
      // If this package has looped through all its versions, increment the next
      // package's pointer and reset this one.
      if (i === pkgs.length - 1) {
        // If this is the last package and it has gone through all versions then
        // there is no "next" package set.
        return null
      }
      ++pkgs[i + 1].next
      pkg.next = 0
    }
    for (const name of pkg.names) {
      nextPackages[name] = pkg.versions[pkg.next]
    }
  }

  // The next run should use the next version of the first package.
  ++pkgs[0].next

  return nextPackages
}

TestMatrix.prototype._calculateLength = function _calculateLength() {
  //  [{
  //    "packages": [{
  //      "names": ["redis"],         // <-- Package name(s). Grouped deps have
  //                                  //     multiple names sharing one iterator.
  //      "next": 0,                  // <-- Iteration point.
  //      "versions": [               // <-- List of versions to iterate through.
  //        "1.2", "1.3", "2.0"
  //      ]
  //    }],
  //    "tests": {
  //      "files": ["redis.test.js"],  // <-- List of test files to iterate through.
  //      "next": 0                   // <-- File iteration point.
  //    }
  //  }]
  let totalLength = 0
  for (let i = 0; i < this._matrix.length; ++i) {
    const suite = this._matrix[i]
    let pkgCombinations = 1
    for (let j = 0; j < suite.packages.length; ++j) {
      pkgCombinations *= suite.packages[j].versions.length
    }
    totalLength += pkgCombinations * suite.tests.files.length
  }
  return totalLength
}

module.exports = TestMatrix
