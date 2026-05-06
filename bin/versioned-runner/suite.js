/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const EventEmitter = require('events').EventEmitter
const path = require('path')
const util = require('util')
const semver = require('semver')
const packager = require('./packager')
const Test = require('./test')
const defaults = {
  limit: 1,
  versions: 'minor',
  testPatterns: [],
  globalSamples: null,
  matrixCountOnly: false
}

function Suite(testFolders, opts) {
  this.testFolders = testFolders
  this.pkgsMeta = {}
  this.opts = { ...defaults, ...opts }
  this.failures = []
}
util.inherits(Suite, EventEmitter)

/**
 * Builds the metadata for every package in the appropriate test folders.
 * This will iterate over every test folder, get the package.json,
 * iterate over every tests array and find semver ranges,
 * latest flag and static versions for every unique package.
 */
Suite.prototype.prepare = function prepare() {
  this.testFolders.forEach((folder) => {
    const testPackage = require(path.join(folder, 'package'))
    if (testPackage.tests) {
      testPackage.tests.forEach((test) => {
        const dependencies = Object.keys(test.dependencies)
        dependencies.forEach((dep) => {
          const versions = getPkgVersions(test.dependencies[dep])
          this._buildPkgMeta(dep, versions)
        })
      })
    }
  })
}

Suite.prototype.start = async function start() {
  this.prepare()
  const pkgVersions = await this._mapPackagesToVersions()

  if (this.opts.matrixCountOnly === true) {
    this.emit('matrixCountReady')
    this.emit('end')
    return
  }

  await this._runTests(pkgVersions)
  this.emit('end')
}

/**
 * The versions for a package can be a string or object
 * return the appropriate one
 * @param {object} dep to get package version
 * @returns {string} package version
 */
function getPkgVersions(dep) {
  return typeof dep === 'object' ? dep.versions : dep
}

/**
 * This function returns the highest version number of every version in the
 * mode specified.
 *
 * For example, this list of versions in mode "major":
 * [ "1.0.0",
 *   "1.0.1",
 *   "2.0.0",
 *   "2.0.1",
 *   "2.1.1" ]
 * will result in: [ "1.0.1", "2.1.1" ]
 *
 * in mode "minor", it would return: [ "1.0.1", "2.0.1", "2.1.1" ]
 *
 * @param {string} pkg name of package to get all relevant versions
 * @returns {Array} of versions of package
 */
Suite.prototype.maxVersionPerMode = async function maxVersionPerMode(pkg) {
  // Request the package information from NPM's registry.
  const pkgs = await packager.load(pkg)
  let versions = Object.keys(pkgs)
  const meta = this.pkgsMeta[pkg]
  const mode = this.opts.versions
  const semverRanges = meta.semverRanges.join(' || ')
  const includeLatest = meta.latest
  const { staticVersions } = meta
  // Remove versions that don't fit the semantic versioning convention
  versions = versions.filter((version) => /^\d+\.\d+\.\d+$/.test(version))
  versions = semver.sort(versions)

  if (mode === 'patch') {
    return versions
  }

  const versionRegex = mode === 'major' ? /^(\d+)/ : /^(\d+\.\d+)/
  const greatestVersions = []
  const latestVersion = versions[versions.length - 1]

  const versionsByMajor = versions.reduce((previousValue, version) => {
    const versionMode = versionRegex.exec(version)[1]
    if (!Object.prototype.hasOwnProperty.call(previousValue, versionMode)) {
      previousValue[versionMode] = []
    }

    if (staticVersions.includes(version)) {
      greatestVersions.push(version)
    }

    previousValue[versionMode].push(version)
    return previousValue
  }, {})

  // put the latest first to avoid duplicates of the same version
  // when looking for max within a semver range
  if (includeLatest) {
    greatestVersions.push(latestVersion)
  }

  Object.values(versionsByMajor).forEach((value) => {
    const maxVersion = semver.maxSatisfying(value, semverRanges)
    if (maxVersion && !greatestVersions.includes(maxVersion)) {
      greatestVersions.push(maxVersion)
    }
  })

  return semver.sort(greatestVersions)
}

/**
 * Creates a key in the pkgsMeta for every package.  Each package
 * will have an array of semver ranges, a latest flag(if a test wants only the latest of the package), and static versions.
 * @param {string} name name of package
 * @param {Array} versions list of versions for package
 */
Suite.prototype._buildPkgMeta = function _buildPkgMeta(name, versions) {
  if (!Object.prototype.hasOwnProperty.call(this.pkgsMeta, name)) {
    this.pkgsMeta[name] = { semverRanges: [], latest: false, staticVersions: [] }
  }

  if (versions === 'latest') {
    this.pkgsMeta[name].latest = true
    // Static version if it starts with a digit and does not end in `.x`
    // i.e - 3.0.0(static), 3.x(not static)
  } else if (versions.match(/^\d.*[^.x]$/)) {
    this.pkgsMeta[name].staticVersions.push(versions)
  } else {
    this.pkgsMeta[name].semverRanges.push(versions)
  }
}

Suite.prototype._mapPackagesToVersions = async function _mapPackagesToVersions() {
  const packages = Object.keys(this.pkgsMeta)
  const self = this
  const versionsFinal = await mapLimit(packages, this.opts.limit, async function loadPkgs(pkg) {
    const versions = await self.maxVersionPerMode(pkg)
    self.emit('packageResolved', pkg, versions)
    return { versions, latest: versions[versions.length - 1] }
  })

  const pkgInfo = {}
  for (let i = 0; i < packages.length; ++i) {
    pkgInfo[packages[i]] = versionsFinal[i]
  }

  // Now we have all of the package versions we'll need in an object looking
  // like this: {"package": { "versions": ["1.2", "1.3", "2.0"], "latest": "2.0"}}
  return pkgInfo
}

Suite.prototype._runTests = async function _runTests(pkgVersions) {
  this.failures = []
  const self = this

  const queue = createQueue(function done(test, queueCb) {
    const testRun = test.run()
    if (!testRun) {
      self.emit('update', test, 'done')
      return queueCb()
    }

    testRun.on('error', function errorHandler() {
      self.failures.push(test)
      self.emit('update', test, 'error')
    })

    testRun.on('end', function endHandler() {
      if (testRun.failed) {
        self.failures.push(test)
        self.emit('update', test, 'failure')
      } else {
        // The test didn't fail and wants to continue, so update its status and
        // then requeue it in the front of the pack.
        self.emit('update', test, 'success')
        queue.unshift(test)
      }

      queueCb()
    })

    if (testRun.needsInstall) {
      self.emit('update', test, 'installing')
    }
    testRun.continue()
    testRun.once('completed', () => {
      self.emit('update', test, 'running')
      testRun.continue()
    })
  }, this.opts.limit)

  // Build and queue all of our test directories. The tests are sorted by number
  // of runs required so the longer tests start sooner.
  this.tests = this.testFolders
    .map((folder) => new Test(folder, pkgVersions, this.opts))
    .sort((firstEl, secondEl) => secondEl.matrix.length - firstEl.matrix.length)
  this.tests.forEach((test) => {
    queue.push(test)
  })

  await queue.drain()
}

async function mapLimit(items, limit, fn) {
  if (items.length === 0) {
    return []
  }
  return new Promise((resolve, reject) => {
    const results = new Array(items.length)
    let index = 0
    let completed = 0
    let failed = false
    const workerCount = Math.min(limit, items.length)

    function next() {
      if (failed || index >= items.length) return
      const i = index++
      fn(items[i]).then((result) => {
        if (failed) return
        results[i] = result
        completed++
        if (completed === items.length) {
          resolve(results)
        } else {
          next()
        }
      }).catch((err) => {
        if (!failed) {
          failed = true
          reject(err)
        }
      })
    }

    for (let i = 0; i < workerCount; i++) {
      next()
    }
  })
}

function createQueue(worker, limit) {
  const items = []
  let running = 0
  let drainResolve = null

  function process() {
    while (running < limit && items.length > 0) {
      const item = items.shift()
      running++
      worker(item, function done() {
        running--
        process()
        if (running === 0 && items.length === 0 && drainResolve) {
          const resolve = drainResolve
          drainResolve = null
          resolve()
        }
      })
    }
  }

  return {
    push(item) {
      items.push(item)
      process()
    },
    unshift(item) {
      items.unshift(item)
    },
    drain() {
      if (running === 0 && items.length === 0) {
        return Promise.resolve()
      }
      return new Promise((resolve) => {
        drainResolve = resolve
      })
    }
  }
}

module.exports = Suite
