/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const path = require('path')
const { fsPromises } = require('./util/unwrapped-core')
const os = require('os')
const logger = require('./logger').child({ component: 'environment' })
const stringify = require('json-stringify-safe')
const asyncEachLimit = require('./util/async-each-limit')
const DISPATCHER_VERSION = 'Dispatcher Version'
const semver = require('semver')

// As of 1.7.0 you can no longer dynamically link v8
// https://github.com/nodejs/io.js/commit/d726a177ed
const remapping = {
  node_install_npm: 'npm installed?',
  node_install_waf: 'WAF build system installed?',
  node_use_openssl: 'OpenSSL support?',
  node_shared_openssl: 'Dynamically linked to OpenSSL?',
  node_shared_v8: 'Dynamically linked to V8?',
  node_shared_zlib: 'Dynamically linked to Zlib?',
  node_use_dtrace: 'DTrace support?',
  node_use_etw: 'Event Tracing for Windows (ETW) support?'
}

let settings = Object.create(null)

/**
 * Fetches the setting of the given name, defaulting to an empty array.
 *
 * @param {string} name - The name of the setting to look for.
 * @returns {Array.<string>} An array of values matching that name.
 */
function getSetting(name) {
  return settings[name] || []
}

/**
 * Add a setting to the module's shared settings object.
 *
 * @param {string} name   - The name of the setting value being added.
 * @param {string} value  - The value to add or the setting.
 */
function addSetting(name, value) {
  if (!settings[name]) {
    settings[name] = [value]
  } else if (settings[name].indexOf(value) === -1) {
    settings[name].push(value)
  }
}

/**
 * Remove settings with the given name.
 *
 * @param {string} name - The name of the setting to remove.
 */
function clearSetting(name) {
  delete settings[name]
}

/**
 * Build up a list of top-level packages available to an application relative to
 * the provided root.
 *
 * @param {string}    root          - Path to start listing packages from.
 * @param {Array}     [packages=[]] - Array to append found packages to.
 */
async function listPackages(root, packages = []) {
  _log('Listing packages in %s', root)

  try {
    const dirs = await fsPromises.readdir(root)
    await asyncEachLimit(dirs, forEachDir, 2)
    _log('Done listing packages in %s', root)
  } catch (err) {
    logger.trace(err, 'Could not list packages in %s (probably not an error)', root)
  }

  async function forEachDir(dir) {
    _log('Checking package %s in %s', dir, root)

    // Skip npm's binary directory where it stores executables.
    if (dir === '.bin') {
      _log('Skipping .bin directory')
      return
    }

    // Recurse into module scopes.
    if (dir[0] === '@') {
      logger.trace('Recursing into scoped module directory %s', dir)
      return listPackages(path.resolve(root, dir), packages)
    }

    // Read the package and pull out the name and version of it.
    const pkg = path.resolve(root, dir, 'package.json')
    let name = null
    let version = null
    try {
      const pkgFile = await fsPromises.readFile(pkg)
      _log('Read package at %s', pkg)
      ;({ name, version } = JSON.parse(pkgFile))
    } catch (err) {
      logger.debug(err, 'Could not read %s.', pkg)
    }

    packages.push([name || dir, version || '<unknown>'])
    _log('Package from %s added (%s@%s)', pkg, name, version)
  }
}

/**
 * Build up a list of dependencies from a given node_module root.
 *
 * @param {string}    root        - Path to start listing dependencies from.
 * @param {Array}     [children]  - Array to append found dependencies to.
 * @param {object}    [visited]   - Map of visited directories.
 */
async function listDependencies(root, children = [], visited = Object.create(null)) {
  _log('Listing dependencies in %s', root)

  try {
    const dirs = await fsPromises.readdir(root)
    await asyncEachLimit(dirs, forEachEntry, 2)
    _log('Done listing dependencies in %s', root)
  } catch (err) {
    logger.trace(err, 'Could not read directories in %s (probably not an error)', root)
  }

  async function forEachEntry(entry) {
    _log('Checking dependencies in %s (%s)', entry, root)

    const candidate = path.resolve(root, entry, 'node_modules')
    try {
      const realCandidate = await fsPromises.realpath(candidate)
      _log('Resolved %s to real path %s', candidate, realCandidate)
      // Make sure we haven't been to this directory before.
      if (visited[realCandidate]) {
        logger.trace('Not revisiting %s (from %s)', realCandidate, candidate)
        return
      }

      visited[realCandidate] = true

      // Load the packages and dependencies for this directory.
      await listPackages(realCandidate, children)
      await listDependencies(realCandidate, children, visited)
      _log('Done with dependencies in %s', realCandidate)
    } catch (err) {
      // Don't care to log about files that don't exist.
      if (err.code !== 'ENOENT') {
        logger.debug(err, 'Failed to resolve candidate real path %s', candidate)
      }
      _log(err, 'Real path for %s failed', candidate)
    }
  }
}

/**
 * Build up a list of packages, starting from the current directory.
 *
 * @returns {object} Two lists, of packages and dependencies, with the
 *  appropriate names.
 */
async function getLocalPackages() {
  const packages = []
  const dependencies = []
  let candidate = process.cwd()
  const visited = Object.create(null)
  _log('Getting local packages')

  while (candidate) {
    _log('Checking for local packages in %s', candidate)
    const root = path.resolve(candidate, 'node_modules')
    await listPackages(root, packages)
    await listDependencies(root, dependencies, visited)
    _log('Done checking for local packages in %s', candidate)
    const last = candidate
    candidate = path.dirname(candidate)
    if (last === candidate) {
      candidate = null
    }
  }

  _log('Done getting local packages')
  return { packages, dependencies }
}

/**
 * Generic method for getting packages and dependencies relative to a
 * provided root directory.
 *
 * @param {string} root - Where to start looking -- doesn't add node_modules.
 * @returns {object} Two lists, of packages and dependencies, with the
 *  appropriate names.
 */
async function getPackages(root) {
  const packages = []
  const dependencies = []
  _log('Getting packages from %s', root)

  await listPackages(root, packages)
  await listDependencies(root, dependencies)
  _log('Done getting packages from %s', root)
  return { packages, dependencies }
}

/**
 * Generate a list of globally-installed packages, if available / accessible
 * via the environment.
 *
 * @returns {object} Two lists, of packages and dependencies, with the
 *  appropriate names.
 */
function getGlobalPackages() {
  _log('Getting global packages')
  if (process.config && process.config.variables) {
    const prefix = process.config.variables.node_prefix
    if (prefix) {
      const root = path.resolve(prefix, 'lib', 'node_modules')
      _log('Getting global packages from %s', root)
      return getPackages(root)
    }
  }

  _log('No global packages to get')
  return { packages: [], dependencies: [] }
}

/**
 * Take a list of packages and reduce it to a list of pairs serialized
 * to JSON (to simplify things on the collector end) where each
 * package appears at most once, with all the versions joined into a
 * comma-delimited list.
 *
 * @param {Array} packages list of packages to process
 * @returns {Array.<string[]>} Sorted list of [name, version] pairs.
 */
function flattenVersions(packages) {
  const info = Object.create(null)
  packages.forEach((pair) => {
    const p = pair[0]
    const v = pair[1]

    if (info[p]) {
      if (info[p].indexOf(v) < 0) {
        info[p].push(v)
      }
    } else {
      info[p] = [v]
    }
  })

  return Object.keys(info)
    .map((key) => [key, info[key].join(', ')])
    .sort()
    .map((pair) => {
      try {
        return stringify(pair)
      } catch (err) {
        logger.debug(err, 'Unable to stringify package version')
        return '<unknown>'
      }
    })
}

/**
 * There are a bunch of settings generated at build time that are useful to
 * know for troubleshooting purposes. These settings are only available in 0.7
 * and up.
 *
 * This function works entirely via side effects using the
 * addSetting function.
 */
function remapConfigSettings() {
  if (process.config && process.config.variables) {
    const variables = process.config.variables
    Object.keys(variables).forEach((key) => {
      if (remapping[key]) {
        let value = variables[key]

        if (value === true || value === 1) {
          value = 'yes'
        }
        if (value === false || value === 0) {
          value = 'no'
        }

        addSetting(remapping[key], value)
      }
    })

    maybeAddMissingProcessVars()
  }
}

/**
 * As of Node 19 DTrace and ETW are no longer bundled
 * see: https://nodejs.org/en/blog/announcements/v19-release-announce#dtrace/systemtap/etw-support
 */
function maybeAddMissingProcessVars() {
  if (semver.gte(process.version, '19.0.0')) {
    addSetting(remapping.node_use_dtrace, 'no')
    addSetting(remapping.node_use_etw, 'no')
  }
}

async function getOtherPackages() {
  _log('Getting other packages')
  const other = { packages: [], dependencies: [] }

  if (!process.env.NODE_PATH) {
    return other
  }

  let paths
  if (process.platform === 'win32') {
    // why. WHY.
    paths = process.env.NODE_PATH.split(';')
  } else {
    paths = process.env.NODE_PATH.split(':')
  }
  _log('Looking for other packages in %j', paths)

  const otherPackages = await asyncEachLimit(
    paths,
    (nodePath) => {
      if (nodePath[0] !== '/') {
        nodePath = path.resolve(process.cwd(), nodePath)
      }
      _log('Getting other packages from %s', nodePath)
      return getPackages(nodePath)
    },
    2
  )

  otherPackages.forEach((pkg) => {
    other.packages.push.apply(other.packages, pkg.packages)
    other.dependencies.push.apply(other.dependencies, pkg.dependencies)
  })

  _log('Done getting other packages')
  return other
}

async function getHomePackages() {
  let homeDir = null
  if (process.platform === 'win32') {
    if (process.env.USERDIR) {
      homeDir = process.env.USERDIR
    }
  } else if (process.env.HOME) {
    homeDir = process.env.HOME
  }

  _log('Getting home packages from %s', homeDir)
  if (!homeDir) {
    return
  }

  const homePath = path.resolve(homeDir, '.node_modules')
  const homeOldPath = path.resolve(homeDir, '.node_libraries')
  const home = await getPackages(homePath)
  const homeOld = await getPackages(homeOldPath)
  return { home, homeOld }
}

/**
 * Scrape the list of packages, following the algorithm as described in the
 * node module page:
 *
 * http://nodejs.org/docs/latest/api/modules.html
 *
 * This function works entirely via side effects using the addSetting
 * function.
 */
async function findPackages() {
  _log('Finding all packages')
  const pkgPromises = [
    time(getLocalPackages),
    time(getGlobalPackages),
    time(getOtherPackages),
    time(getHomePackages)
  ]
  const [local, global, other, home] = await Promise.all(pkgPromises)
  _log('Done finding all packages')
  const packages = local.packages
  packages.push.apply(packages, global.packages)
  packages.push.apply(packages, other.packages)

  const dependencies = local.dependencies
  dependencies.push.apply(dependencies, global.dependencies)
  dependencies.push.apply(dependencies, other.dependencies)

  if (home) {
    if (home.home) {
      packages.unshift.apply(packages, home.home.packages)
      dependencies.unshift.apply(dependencies, home.home.dependencies)
    }
    if (home.homeOld) {
      packages.unshift.apply(packages, home.homeOld.packages)
      dependencies.unshift.apply(dependencies, home.homeOld.dependencies)
    }
  }

  addSetting('Packages', flattenVersions(packages))
  addSetting('Dependencies', flattenVersions(dependencies))
}

async function time(fn) {
  const name = fn.name
  const start = Date.now()
  logger.trace('Starting %s', name)
  const data = await fn()
  const end = Date.now()
  logger.trace('Finished %s in %dms', name, end - start)
  return data
}

/**
 * Settings actually get scraped below.
 */
function gatherEnv() {
  addSetting('Processors', os.cpus().length)
  addSetting('OS', os.type())
  addSetting('OS version', os.release())
  addSetting('Node.js version', process.version)
  addSetting('Architecture', process.arch)

  if ('NODE_ENV' in process.env) {
    addSetting('NODE_ENV', process.env.NODE_ENV)
  }
}

function refreshSyncOnly() {
  // gather persisted settings
  const framework = getSetting('Framework')
  const dispatcher = getSetting('Dispatcher')
  const dispatcherVersion = getSetting(DISPATCHER_VERSION)

  // clearing and rebuilding a global variable
  settings = Object.create(null)
  // add persisted settings
  if (framework.length) {
    framework.forEach(function addFrameworks(fw) {
      addSetting('Framework', fw)
    })
  }

  if (dispatcher.length) {
    dispatcher.forEach(function addDispatchers(d) {
      addSetting('Dispatcher', d)
    })
  }

  if (dispatcherVersion.length) {
    dispatcher.forEach(function addDispatchers(d) {
      addSetting(DISPATCHER_VERSION, d)
    })
  }

  gatherEnv()
  remapConfigSettings()
}

/**
 * Reset settings and gather them, built to minimally refactor this file.
 */
async function refresh() {
  _log('Refreshing environment settings')
  refreshSyncOnly()

  const packages = getSetting('Packages')
  const dependencies = getSetting('Dependencies')

  if (packages.length && dependencies.length) {
    settings.Packages = packages
    settings.Dependencies = dependencies
    _log('Using cached values')
    return
  }
  _log('Fetching new package information')
  await findPackages()
}

/**
 * Refreshes settings and returns the settings object.
 *
 * @private
 * @returns {Promise} the updated/refreshed settings
 */
async function getJSON() {
  _log('Getting environment JSON')
  try {
    await refresh()
  } catch (err) {
    // swallow error
  }

  const items = []
  Object.keys(settings).forEach(function settingKeysForEach(key) {
    settings[key].forEach(function settingsValuesForEach(setting) {
      items.push([key, setting])
    })
  })
  _log('JSON got')
  return items
}

// At startup, do the synchronous environment scanning stuff.
refreshSyncOnly()

let userSetDispatcher = false
module.exports = {
  setFramework: function setFramework(framework) {
    addSetting('Framework', framework)
  },
  setDispatcher: function setDispatcher(dispatcher, version, userSet) {
    if (userSetDispatcher) {
      return
    }

    userSetDispatcher = !!userSet
    clearSetting(DISPATCHER_VERSION)
    clearSetting('Dispatcher')

    // TODO: Decide if this should only happen once for internals as well.
    if (version) {
      addSetting(DISPATCHER_VERSION, version)
    }

    addSetting('Dispatcher', dispatcher)
  },
  clearFramework: function clearFramework() {
    clearSetting('Framework')
  },
  clearDispatcher: function clearDispatcher() {
    // This method is only used for tests.
    userSetDispatcher = false
    clearSetting('Dispatcher')
    clearSetting(DISPATCHER_VERSION)
  },
  listPackages,
  getJSON,
  get: getSetting,
  refresh
}

/**
 * For super verbose logging that we can disable completely, separate from the
 * rest of logging.
 */
function _log() {
  // logger.trace.apply(logger, arguments)
}
