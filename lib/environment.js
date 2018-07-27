'use strict'

var a = require('async')
var path = require('path')
var fs = require('./util/unwrapped-core').fs
var os = require('os')
var logger = require('./logger').child({component: 'environment'})
var stringify = require('json-stringify-safe')


// As of 1.7.0 you can no longer dynamically link v8
// https://github.com/nodejs/io.js/commit/d726a177ed
var remapping = {
  node_install_npm: "npm installed?",
  node_install_waf: "WAF build system installed?",
  node_use_openssl: "OpenSSL support?",
  node_shared_openssl: "Dynamically linked to OpenSSL?",
  node_shared_v8: "Dynamically linked to V8?",
  node_shared_zlib: "Dynamically linked to Zlib?",
  node_use_dtrace: "DTrace support?",
  node_use_etw: "Event Tracing for Windows (ETW) support?"
}

var settings = Object.create(null)

/**
 * Fetches the setting of the given name, defaulting to an empty array.
 *
 * @param {string} name - The name of the setting to look for.
 *
 * @return {Array.<string>} An array of values matching that name.
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
 * @param {function}  callback      - Callback function.
 *
 * @return {Array} List of packages.
 */
function listPackages(root, packages, callback) {
  // listPackages(root, callback)
  if (typeof packages === 'function') {
    callback = packages
    packages = []
  }
  _log('Listing packages in %s', root)

  a.waterfall([
    a.apply(fs.readdir, root),
    function iterateDirs(dirs, cb) {
      a.eachLimit(dirs, 2, forEachDir, cb)
    }
  ], function onAllDirsRead(err) {
    _log('Done listing packages in %s', root)
    if (err) {
      logger.trace(err, 'Could not list packages in %s (probably not an error)', root)
      return callback()
    }
    callback(null, packages)
  })

  function forEachDir(dir, cb) {
    _log('Checking package %s in %s', dir, root)

    // Skip npm's binary directory where it stores executables.
    if (dir === '.bin') {
      _log('Skipping .bin directory')
      return setImmediate(cb)
    }

    // Recurse into module scopes.
    if (dir[0] === '@') {
      logger.trace('Recursing into scoped module directory %s', dir)
      return listPackages(path.resolve(root, dir), packages, cb)
    }

    // Read the package and pull out the name and version of it.
    var pkg = path.resolve(root, dir, 'package.json')
    fs.readFile(pkg, function onPackageRead(err, pkgFile) {
      _log('Read package at %s', pkg)
      if (err) {
        logger.debug(err, 'Could not read %s.', pkg)
        return cb()
      }

      var name = null
      var version = null
      try {
        var pkgData = JSON.parse(pkgFile)
        name = pkgData.name
        version = pkgData.version
      } catch (e) {
        logger.debug(err, 'Could not parse package file %s.', pkg)
      }

      packages.push([name || dir, version || '<unknown>'])
      _log('Package from %s added (%s@%s)', pkg, name, version)
      cb()
    })
  }
}

/**
 * Build up a list of dependencies from a given node_module root.
 *
 * @param {string}    root        - Path to start listing dependencies from.
 * @param {Array}     [children]  - Array to append found dependencies to.
 * @param {object}    [visited]   - Map of visited directories.
 * @param {function}  callback    - Callback to send deps to.
 *
 * @return {Array} List of dependencies.
 */
function listDependencies(root, children, visited, callback) {
  // listDependencies(root, callback)
  if (typeof children === 'function') {
    callback = children
    children = []
    visited = Object.create(null)
  }
  // listDependencies(root, {children|visited}, callback)
  if (typeof visited === 'function') {
    callback = visited
    if (Array.isArray(children)) {
      visited = Object.create(null)
    } else {
      visited = children
      children = []
    }
  }
  _log('Listing dependencies in %s', root)

  a.waterfall([
    a.apply(fs.readdir, root),
    function iterateDirs(dirs, cb) {
      a.eachLimit(dirs, 2, forEachEntry, cb)
    }
  ], function onAllDirsRead(err) {
    _log('Done listing dependencies in %s', root)
    if (err) {
      logger.trace(err, 'Could not read directories in %s (probably not an error)', root)
      return callback()
    }
    callback(null, children)
  })

  function forEachEntry(entry, cb) {
    _log('Checking dependencies in %s (%s)', entry, root)

    var candidate = path.resolve(root, entry, 'node_modules')
    fs.realpath(candidate, function realPathCb(err, realCandidate) {
      _log('Resolved %s to real path %s', candidate, realCandidate)
      if (err) {
        // Don't care to log about files that don't exist.
        if (err.code !== 'ENOENT') {
          logger.debug(err, 'Failed to resolve candidate real path %s', candidate)
        }
        _log(err, 'Real path for %s failed', candidate)
        return cb()
      }

      // Make sure we haven't been to this directory before.
      if (visited[realCandidate]) {
        logger.trace('Not revisiting %s (from %s)', realCandidate, candidate)
        return cb()
      }
      visited[realCandidate] = true

      // Load the packages and dependencies for this directory.
      a.series([
        a.apply(listPackages, realCandidate, children),
        a.apply(listDependencies, realCandidate, children, visited)
      ], function onRecurseListComplete(loadErr) {
        _log('Done with dependencies in %s', realCandidate)
        if (loadErr) {
          logger.debug(loadErr, 'Failed to list dependencies in %s', realCandidate)
        }
        cb()
      })
    })
  }
}

/**
 * Build up a list of packages, starting from the current directory.
 *
 * @return {Object} Two lists, of packages and dependencies, with the
 *  appropriate names.
 */
function getLocalPackages(callback) {
  var packages = []
  var dependencies = []
  var candidate = process.cwd()
  var visited = Object.create(null)
  _log('Getting local packages')

  a.whilst(function checkCandidate() {
    return candidate
  }, function iterate(cb) {
    _log('Checking for local packages in %s', candidate)
    var root = path.resolve(candidate, 'node_modules')
    a.series([
      a.apply(listPackages, root, packages),
      a.apply(listDependencies, root, dependencies, visited)
    ], function onListComplete(err) {
      _log('Done checking for local packages in %s', candidate)
      var last = candidate
      candidate = path.dirname(candidate)
      if (last === candidate) {
        candidate = null
      }
      cb(err)
    })
  }, function whileComplete(err) {
    _log('Done getting local packages')
    if (err) {
      callback(err)
    } else {
      callback(null, {packages: packages, dependencies: dependencies})
    }
  })
}

/**
 * Generic method for getting packages and dependencies relative to a
 * provided root directory.
 *
 * @param {string} root - Where to start looking -- doesn't add node_modules.
 *
 * @return {Object} Two lists, of packages and dependencies, with the
 *  appropriate names.
 */
function getPackages(root, cb) {
  var packages = []
  var dependencies = []
  _log('Getting packages from %s', root)

  a.series([
    a.apply(listPackages, root, packages),
    a.apply(listDependencies, root, dependencies)
  ], function onListComplete(err) {
    _log('Done getting packages from %s', root)
    if (err) {
      cb(err)
    } else {
      cb(null, {packages: packages, dependencies: dependencies})
    }
  })
}

/**
 * Generate a list of globally-installed packages, if available / accessible
 * via the environment.
 *
 * @return {Object} Two lists, of packages and dependencies, with the
 *  appropriate names.
 */
function getGlobalPackages(cb) {
  _log('Getting global packages')
  if (process.config && process.config.variables) {
    var prefix = process.config.variables.node_prefix
    if (prefix) {
      var root = path.resolve(prefix, 'lib', 'node_modules')
      _log('Getting global packages from %s', root)
      return getPackages(root, cb)
    }
  }

  _log('No global packages to get')
  setImmediate(cb, null, {packages: [], dependencies: []})
}

/**
 * Take a list of packages and reduce it to a list of pairs serialized
 * to JSON (to simplify things on the collector end) where each
 * package appears at most once, with all the versions joined into a
 * comma-delimited list.
 *
 * @return {Array.<string[]>} Sorted list of [name, version] pairs.
 */
function flattenVersions(packages) {
  var info = Object.create(null)
  packages.forEach(function cb_forEach(pair) {
    var p = pair[0]
    var v = pair[1]

    if (info[p]) {
      if (info[p].indexOf(v) < 0) info[p].push(v)
    } else {
      info[p] = [v]
    }
  })

  return Object.keys(info)
    .map(function cb_map(key) {
      return [key, info[key].join(', ')]
    })
    .sort()
    .map(function cb_map(pair) {
      try {
        return stringify(pair)
      } catch (err) {
        logger.debug(err, 'Unabled to stringify package version')
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
    var variables = process.config.variables
    Object.keys(variables).forEach(function cb_forEach(key) {
      if (remapping[key]) {
        var value = variables[key]

        if (value === true || value === 1) value = 'yes'
        if (value === false || value === 0) value = 'no'

        addSetting(remapping[key], value)
      }
    })
  }
}

function getOtherPackages(callback) {
  _log('Getting other packages')
  var other = {packages: [], dependencies: []}

  if (!process.env.NODE_PATH) {
    return callback(null, other)
  }

  var paths
  if (process.platform === 'win32') { // why. WHY.
    paths = process.env.NODE_PATH.split(';')
  } else {
    paths = process.env.NODE_PATH.split(':')
  }
  _log('Looking for other packages in %j', paths)

  a.eachLimit(paths, 2, function listEachOtherPackage(nodePath, cb) {
    if (nodePath[0] !== '/') nodePath = path.resolve(process.cwd(), nodePath)
    _log('Getting other packages from %s', nodePath)
    getPackages(nodePath, function onGetPackageFinish(err, nextSet) {
      _log('Done getting other packages from %s', nodePath)
      if (!err && nextSet) {
        other.packages.push.apply(other.packages, nextSet.packages)
        other.dependencies.push.apply(other.dependencies, nextSet.dependencies)
      }
      cb(err)
    })
  }, function onOtherFinish(err) {
    _log('Done getting other packages')
    callback(err, other)
  })
}

function getHomePackages(cb) {
  var homeDir = null
  if (process.platform === 'win32') {
    if (process.env.USERDIR) {
      homeDir = process.env.USERDIR
    }
  } else if (process.env.HOME) {
    homeDir = process.env.HOME
  }

  _log('Getting home packages from %s', homeDir)
  if (!homeDir) {
    return cb(null, null)
  }

  a.mapSeries({
    home: path.resolve(homeDir, '.node_modules'),
    homeOld: path.resolve(homeDir, '.node_libraries')
  }, getPackages, function onHomeFinish(err, packages) {
    _log('Done getting home packages from %s', homeDir)
    cb(err, packages)
  })
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
function findPackages(cb) {
  _log('Finding all packages')
  a.parallelLimit({
    local: time(getLocalPackages),
    global: time(getGlobalPackages),
    other: time(getOtherPackages),
    home: time(getHomePackages)
  }, 2, function onPackageComplete(err, data) {
    _log('Done finding all packages')
    if (err) {
      return cb(err)
    }

    var packages = data.local.packages
    packages.push.apply(packages, data.global.packages)
    packages.push.apply(packages, data.other.packages)

    var dependencies = data.local.dependencies
    dependencies.push.apply(dependencies, data.global.dependencies)
    dependencies.push.apply(dependencies, data.other.dependencies)

    if (data.home) {
      if (data.home.home) {
        packages.unshift.apply(packages, data.home.home.packages)
        dependencies.unshift.apply(dependencies, data.home.home.dependencies)
      }
      if (data.home.homeOld) {
        packages.unshift.apply(packages, data.home.homeOld.packages)
        dependencies.unshift.apply(dependencies, data.home.homeOld.dependencies)
      }
    }

    addSetting('Packages', flattenVersions(packages))
    addSetting('Dependencies', flattenVersions(dependencies))
    cb()
  })
}

function time(fn) {
  var name = fn.name
  return function timeWrapper(cb) {
    var start = Date.now()
    logger.trace('Starting %s', name)
    return fn(function wrappedCb() {
      var end = Date.now()
      logger.trace('Finished %s in %dms', name, end - start)
      cb.apply(this, arguments)
    })
  }
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
  var framework = getSetting('Framework')
  var dispatcher = getSetting('Dispatcher')
  var dispatcherVersion = getSetting('Dispatcher Version')

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
      addSetting('Dispatcher Version', d)
    })
  }

  gatherEnv()
  remapConfigSettings()
}

/**
 * Reset settings and gather them, built to minimally refactor this file.
 */
function refresh(cb) {
  _log('Refreshing environment settings')
  refreshSyncOnly()

  var packages = getSetting('Packages')
  var dependencies = getSetting('Dependencies')

  if (packages.length && dependencies.length) {
    settings.Packages = packages
    settings.Dependencies = dependencies
    _log('Using cached values')
    setImmediate(cb)
  } else {
    _log('Fetching new package information')
    findPackages(cb)
  }
}

/**
 * Refreshes settings and returns the settings object.
 *
 * @private
 *
 * @param {function} cb - Callback to send results to.
 */
function getJSON(cb) {
  _log('Getting environment JSON')
  refresh(function onRefreshFinish(err) {
    _log('Environment refresh finished')
    if (err) {
      cb(err)
      return
    }

    var items = []
    Object.keys(settings).forEach(function settingKeysForEach(key) {
      settings[key].forEach(function settingsValuesForEach(setting) {
        items.push([key, setting])
      })
    })
    _log('JSON got')
    cb(null, items)
  })
}

// At startup, do the synchronous environment scanning stuff.
refreshSyncOnly()

var userSetDispatcher = false
module.exports = {
  setFramework: function setFramework(framework) {
    addSetting('Framework', framework)
  },
  setDispatcher: function setDispatcher(dispatcher, version, userSet) {
    if (userSetDispatcher) {
      return
    }

    userSetDispatcher = !!userSet
    clearSetting('Dispatcher Version')
    clearSetting('Dispatcher')

    // TODO: Decide if this should only happen once for internals as well.
    if (version) {
      addSetting('Dispatcher Version', version)
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
    clearSetting('Dispatcher Version')
  },
  listPackages: listPackages,
  getJSON: getJSON,
  get: getSetting,
  refresh: refresh
}

/**
 * For super verbose logging that we can disable completely, separate from the
 * rest of logging.
 */
function _log() {
  // logger.trace.apply(logger, arguments)
}
