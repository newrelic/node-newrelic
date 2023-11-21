/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const path = require('path')
const semver = require('semver')
const fs = require('./util/unwrapped-core').fs
const logger = require('./logger').child({ component: 'shimmer' })
const INSTRUMENTATIONS = require('./instrumentations')()
const shims = require('./shim')
const { Hook } = require('require-in-the-middle')
const IitmHook = require('import-in-the-middle')
let pkgsToHook = []

const NAMES = require('./metrics/names')
const symbols = require('./symbols')
const { unsubscribe } = require('./instrumentation/undici')

const MODULE_TYPE = shims.constants.MODULE_TYPE

const CORE_INSTRUMENTATION = {
  child_process: {
    type: MODULE_TYPE.GENERIC,
    file: 'child_process.js'
  },
  crypto: {
    type: MODULE_TYPE.GENERIC,
    file: 'crypto.js'
  },
  // domain: {                     // XXX Do not include domains in this list! The
  //   type: MODULE_TYPE.GENERIC,  // core instrumentations are run at startup by
  //   file: 'domain.js'           // requiring each of their modules. Loading
  // },                            // `domain` has side effects that we try to avoid.
  dns: {
    type: MODULE_TYPE.GENERIC,
    file: 'dns.js'
  },
  fs: {
    type: MODULE_TYPE.GENERIC,
    file: 'fs.js'
  },
  http: {
    type: MODULE_TYPE.TRANSACTION,
    file: 'http.js'
  },
  https: {
    type: MODULE_TYPE.TRANSACTION,
    file: 'http.js'
  },
  inspector: {
    type: MODULE_TYPE.GENERIC,
    file: 'inspector.js'
  },
  net: {
    type: MODULE_TYPE.GENERIC,
    file: 'net.js'
  },
  timers: {
    type: MODULE_TYPE.GENERIC,
    file: 'timers.js'
  },
  zlib: {
    type: MODULE_TYPE.GENERIC,
    file: 'zlib.js'
  }
}

/**
 * Unwrapping is only likely to be used by test code, and is a fairly drastic
 * maneuver, but it should be pretty safe if there's a desire to reboot the
 * agent in flight.
 *
 * All of the wrapped methods are tracked in this constiable and used by unwrapAll
 * below.
 */
let instrumented = []

const shimmer = (module.exports = {
  /**
   * If debug isn't false, the agent will retain references to wrapped methods
   * for the entire lifetime of the agent. Some instrumentation depends on
   * wrapping functions on individual objects, and this will cause the agent
   * to retain references to a large number of dead objects.
   */
  debug: false,

  /**
   * Detects if the given function has already been wrapped.
   *
   * @param {Function} fn - The function to look for a wrapper on.
   * @returns {boolean} True if `fn` exists and has an attached original, else false.
   */
  isWrapped: function isWrapped(fn) {
    return !!(fn && fn[symbols.original])
  },

  /**
   * Don't throw, but do log and bail out if wrapping fails.
   *
   * Provide an escape hatch by creating a closure around the original method
   * and object / module wrapped into a helper function that will restore the
   * original function / method. See Sinon for a systematic use of this
   * pattern.
   *
   * @param {object} nodule Class or module containing the function to wrap.
   * @param {object} noduleName Human-readable module / Class name. More
   *                            helpful than you'd think.
   * @param {string} methods One or more names of methods or functions to extract
   *                         and wrap.
   * @param {Function} wrapper A generator that, when called, returns a
   *                           wrapped version of the original function.
   */
  wrapMethod: function wrapMethod(nodule, noduleName, methods, wrapper) {
    if (!methods) {
      logger.warn(new Error(), 'Must include a method name to wrap. Called from:')
      return
    }

    if (!noduleName) {
      noduleName = '[unknown]'
    }
    if (!Array.isArray(methods)) {
      methods = [methods]
    }

    methods.forEach((method) => {
      const fqmn = noduleName + '.' + method

      if (!nodule) {
        logger.debug("Can't wrap %s from nonexistent object.", fqmn)
        return
      }

      if (!wrapper) {
        logger.debug("Can't wrap %s without a wrapper generator.", fqmn)
        return
      }

      const original = nodule[method]

      if (!original) {
        logger.trace('%s not defined, so not wrapping.', fqmn)
        return
      }
      if (original[symbols.unwrap]) {
        logger.debug('%s already wrapped by agent.', fqmn)
        return
      }

      const wrapped = wrapper(original, method)
      Object.keys(original).forEach((key) => {
        wrapped[key] = original[key]
      })
      wrapped[symbols.original] = original
      // eslint-disable-next-line camelcase
      wrapped[symbols.unwrap] = function unwrap() {
        nodule[method] = original
        logger.trace('Removed instrumentation from %s.', fqmn)
      }

      nodule[method] = wrapped
      if (shimmer.debug) {
        instrumented.push(wrapped)
      }
      logger.trace('Instrumented %s.', fqmn)
    })
  },

  /**
   * Sometimes you gotta do some crazy stuff to get the job done. Instead of using
   * regular monkeypatching, wrapDeprecated allows you to pass in a getter and setter
   * and then uses defineProperty to replace the original property with an
   * accessor. Note that responsibility for unwrapping is not handled by this
   * function.
   *
   * @param {object}   nodule     Class or module containing the property to
   *                              wrap.
   * @param {object}   noduleName Human-readable module / Class name. More
   *                              helpful than you'd think.
   * @param {string}   property   The property to replace with the accessor.
   * @param {Function} options    Optional getter and setter to use for the accessor.
   * @returns {object|undefined} returns original function
   */
  wrapDeprecated: function wrapDeprecated(nodule, noduleName, property, options) {
    if (!property) {
      logger.warn(new Error(), 'Must include a function name to wrap. Called from:')
      return
    }

    if (!noduleName) {
      noduleName = '[unknown]'
    }

    const fqmn = noduleName + '.' + property
    if (!nodule) {
      logger.debug("Can't wrap %s from nonexistent object.", fqmn)
      return
    }

    const original = nodule[property]
    if (!original) {
      logger.trace('%s not defined, so not wrapping.', fqmn)
      return
    }

    delete nodule[property]

    const descriptor = {
      configurable: true,
      enumerable: true
    }
    if (options.get) {
      descriptor.get = options.get
    }
    if (options.set) {
      descriptor.set = options.set
    }
    Object.defineProperty(nodule, property, descriptor)
    logger.trace('Instrumented %s.', fqmn)

    if (shimmer.debug) {
      instrumented.push({
        [symbols.unwrap]: function unwrapDeprecated() {
          delete nodule[property]
          nodule[property] = original
        }
      })
    }

    return original
  },

  unwrapMethod: function unwrapMethod(nodule, noduleName, method) {
    if (!noduleName) {
      noduleName = '[unknown]'
    }
    if (!method) {
      return logger.debug(
        'Must include a method name to unwrap. ' + 'Called from: %s',
        new Error().stack
      )
    }

    const fqmn = noduleName + '.' + method

    if (!nodule) {
      return logger.debug("Can't unwrap %s from nonexistent object.", fqmn)
    }

    const wrapped = nodule[method]

    // keep instrumented up to date
    const pos = instrumented.indexOf(wrapped)
    if (pos !== -1) {
      instrumented.splice(pos, 1)
    }

    if (!wrapped) {
      return logger.debug('%s not defined, so not unwrapping.', fqmn)
    }
    if (!wrapped[symbols.unwrap]) {
      return logger.debug("%s isn't unwrappable.", fqmn)
    }

    wrapped[symbols.unwrap]()
  },

  unwrapAll: function unwrapAll() {
    instrumented.forEach((wrapper) => {
      wrapper[symbols.unwrap]()
    })
    instrumented = []
  },

  /**
   * Registers all instrumentation for 3rd party libraries.
   *
   * This is all 3rd party libs with the exception of the domain library in Node.js core
   *
   * @param {object} agent NR agent
   */
  registerThirdPartyInstrumentation(agent) {
    for (const [moduleName, instrInfo] of Object.entries(INSTRUMENTATIONS)) {
      if (instrInfo.module) {
        // Because external instrumentations can change independent of
        // the agent core, we don't want breakages in them to entirely
        // disable the agent.
        try {
          const hooks = require(instrInfo.module + '/nr-hooks')
          hooks.forEach(shimmer.registerInstrumentation)
        } catch (e) {
          logger.warn('Failed to load instrumentation for ' + instrInfo.module, e)
          return
        }
      } else {
        const fileName = path.join(__dirname, 'instrumentation', moduleName + '.js')
        shimmer.registerInstrumentation({
          moduleName: moduleName,
          type: instrInfo.type,
          onRequire: _firstPartyInstrumentation.bind(null, agent, fileName)
        })
      }
    }

    // Even though domain is a core module we add it as a registered
    // instrumentation to be lazy-loaded because we do not want to cause domain
    // usage.
    const domainPath = path.join(__dirname, 'instrumentation/core/domain.js')
    shimmer.registerInstrumentation({
      moduleName: 'domain',
      type: null,
      onRequire: _firstPartyInstrumentation.bind(null, agent, domainPath)
    })
  },

  /**
   * Registers all instrumentation for Node.js core libraries.
   *
   * @param {object} agent NR agent
   */
  registerCoreInstrumentation(agent) {
    // Instrument global.
    const globalShim = new shims.Shim(agent, 'globals', 'globals')
    applyDebugState(globalShim, global, false)
    const globalsFilepath = path.join(__dirname, 'instrumentation', 'core', 'globals.js')
    _firstPartyInstrumentation(agent, globalsFilepath, globalShim, global, 'globals')

    // Since this just registers subscriptions to diagnostics_channel events from undici
    // We register this as core and it'll work for both fetch and undici
    const undiciPath = path.join(__dirname, 'instrumentation', 'undici.js')
    const undiciShim = shims.createShimFromType({
      type: MODULE_TYPE.TRANSACTION,
      agent,
      moduleName: 'undici',
      resolvedName: 'undici'
    })
    _firstPartyInstrumentation(agent, undiciPath, undiciShim)

    // Instrument each of the core modules.
    for (const [mojule, core] of Object.entries(CORE_INSTRUMENTATION)) {
      const filePath = path.join(__dirname, 'instrumentation', 'core', core.file)
      let uninstrumented = null

      try {
        uninstrumented = require(mojule)
      } catch (err) {
        logger.trace('Could not load core module %s got error %s', mojule, err)
      }

      const shim = shims.createShimFromType({
        type: core.type,
        agent,
        moduleName: mojule,
        resolvedName: mojule
      })
      applyDebugState(shim, core, false)
      _firstPartyInstrumentation(agent, filePath, shim, uninstrumented, mojule)
    }
  },
  registerHooks(agent) {
    this._ritm = new Hook(pkgsToHook, function onHook(exports, name, basedir) {
      return _postLoad(agent, exports, name, basedir)
    })
    this._iitm = new IitmHook(pkgsToHook, function onESMHook(exports, name, basedir) {
      return _postLoad(agent, exports, name, basedir, true)
    })
  },
  removeHooks() {
    if (this._ritm) {
      this._ritm.unhook()
      this._ritm = null
    }

    if (this._iitm) {
      this._iitm.unhook()
      this._iitm = null
    }

    pkgsToHook = []
    unsubscribe()
  },

  bootstrapInstrumentation: function bootstrapInstrumentation(agent) {
    shimmer.registerCoreInstrumentation(agent)
    shimmer.registerThirdPartyInstrumentation(agent)
  },

  registerInstrumentation: function registerInstrumentation(opts) {
    if (!hasValidRegisterOptions(opts)) {
      return
    }

    const registeredInstrumentation = shimmer.registeredInstrumentations[opts.moduleName]

    if (!registeredInstrumentation) {
      shimmer.registeredInstrumentations[opts.moduleName] = []
      // not using a set because this is shared by reference
      // to allow custom instrumentation to be loaded after the
      // agent is bootstrapped
      if (!pkgsToHook.includes(opts.moduleName)) {
        pkgsToHook.push(opts.moduleName)
      }
    }

    opts[symbols.instrumented] = new Set()
    opts[symbols.instrumentedErrored] = new Set()
    shimmer.registeredInstrumentations[opts.moduleName].push({ ...opts })
  },

  registeredInstrumentations: Object.create(null),

  /**
   * NOT FOR USE IN PRODUCTION CODE
   *
   * If an instrumented module has a dependency on another instrumented module,
   * and multiple tests are being run in a single test suite with their own
   * setup and teardown between tests, it's possible transitive dependencies
   * will be unwrapped in the module cache in-place (which needs to happen to
   * prevent stale closures from channeling instrumentation data to incorrect
   * agents, but which means the transitive dependencies won't get re-wrapped
   * the next time the parent module is required).
   *
   * Since this only applies in test code, it's not worth the drastic
   * monkeypatching to Module necessary to walk the list of child modules and
   * re-wrap them.
   *
   * Use this to re-apply any applicable instrumentation.
   *
   * @param {object} agent NR agent
   * @param {string} modulePath path to module getting required
   * @returns {object} exported module
   */
  reinstrument: function reinstrument(agent, modulePath) {
    return _postLoad(agent, require(modulePath), modulePath)
  },

  /**
   * Given a NodeJS module name, return the name/identifier of our
   * instrumentation.  These two things are usually, but not always,
   * the same.
   *
   * @param {string} moduleName name of module getting instrumented
   * @returns {string} name unless pg.js and then returns pg
   */
  getInstrumentationNameFromModuleName(moduleName) {
    // XXX When updating these special cases, also update `uninstrumented`.
    // To allow for instrumenting both 'pg' and 'pg.js'.
    if (moduleName === 'pg.js') {
      moduleName = 'pg'
    }

    return moduleName
  },

  /**
   * Checks all registered instrumentation for a module and returns true
   * only if every hook succeeded.
   *
   * @param {string} moduleName name of registered instrumentation
   * @returns {boolean} if all instrumentation hooks ran for a given version
   */
  isInstrumented(moduleName) {
    const pkgVersion = shimmer.getPackageVersion(moduleName)
    const instrumentations = shimmer.registeredInstrumentations[moduleName]
    const didInstrument = instrumentations.filter((instrumentation) =>
      instrumentation[symbols.instrumented].has(pkgVersion)
    )
    return didInstrument.length === instrumentations.length
  },

  instrumentPostLoad(agent, module, moduleName, resolvedName, returnModule = false) {
    const result = _postLoad(agent, module, moduleName, resolvedName)
    // This is to not break the public API
    // previously it would just call instrumentation
    // and not check the result
    return returnModule ? result : shimmer.isInstrumented(moduleName)
  },

  /**
   * Gets the version of a given package by parsing it from package.json
   *
   * @param {string} moduleName name of module
   * @returns {string} version, defaults to Node.js version when it cannot parse
   */
  getPackageVersion(moduleName) {
    try {
      const { basedir } = shimmer.registeredInstrumentations[moduleName]
      const pkg = require(path.resolve(basedir, 'package.json'))
      return pkg.version
    } catch (err) {
      logger.debug('Failed to get version for `%s`, reason: %s', moduleName, err.message)
      return process.version
    }
  }
})

function applyDebugState(shim, nodule, inEsm) {
  if (shimmer.debug) {
    shim.enableDebug()
    instrumented.push(shim)
    if (!inEsm) {
      instrumented.push({
        [symbols.unwrap]: function unwrapNodule() {
          delete nodule[symbols.shim]
        }
      })
      nodule[symbols.shim] = shim
    }
  }
}

/**
 * All instrumentation files must export the same interface: a single
 * initialization function that takes the agent and the module to be
 * instrumented.
 *
 * @param {object} agent NR agent
 * @param {object} nodule Class or module containing the function to wrap.
 * @param {string} moduleName name of module
 * @param {string} resolvedName fully qualified path to module
 * @param {boolean} esmResolver indicates if it came from esm loader
 * @returns {object|undefined} returns exported module unless already instrumented
 */
function instrumentPostLoad(agent, nodule, moduleName, resolvedName, esmResolver) {
  // default to Node.js version, this occurs for core libraries
  const pkgVersion = resolvedName ? shimmer.getPackageVersion(moduleName) : process.version
  const instrumentations = shimmer.registeredInstrumentations[moduleName]
  instrumentations.forEach((instrumentation) => {
    const isInstrumented = instrumentation[symbols.instrumented].has(pkgVersion)
    const failedInstrumentation = instrumentation[symbols.instrumentedErrored].has(pkgVersion)
    if (isInstrumented || failedInstrumentation) {
      const msg = isInstrumented ? 'Already instrumented' : 'Failed to instrument'
      logger.trace(`${msg} ${moduleName}@${pkgVersion}, skipping registering instrumentation`)
      return
    }

    // We only return the .default when we're a CJS module in the import-in-the-middle(ESM)
    // callback hook
    const resolvedNodule = instrumentation.isEsm || !esmResolver ? nodule : nodule.default

    const shim = shims.createShimFromType({
      type: instrumentation.type,
      agent,
      moduleName,
      resolvedName,
      shimName: instrumentation.shimName,
      pkgVersion
    })

    applyDebugState(shim, resolvedNodule, esmResolver)
    trackInstrumentationUsage(
      agent,
      shim,
      instrumentation.specifier || moduleName,
      NAMES.FEATURES.INSTRUMENTATION.ON_REQUIRE
    )

    // Tracking instrumentation is only used to add the supportability metrics
    // that occur directly above this.  No reason to attempt to load instrumentation
    // as it does not exist.
    if (instrumentation.type === MODULE_TYPE.TRACKING) {
      instrumentation[symbols.instrumented].add(pkgVersion)
      return
    }

    nodule = loadInstrumentation({
      shim,
      resolvedNodule,
      pkgVersion,
      moduleName,
      nodule,
      instrumentation
    })
  })

  return nodule
}

/**
 * Attempts to execute an onRequire hook for a given module.
 * If it fails it will call an onError hook and log warnings accordingly
 *
 * @param {object} params wrapping object to function
 * @param {*} params.shim The instance of the shim used to instrument the module.
 * @param {object} params.nodule Class or module containing the function to wrap.
 * @param {object} params.resolvedNodule returns xport of the default property
 * @param {string} params.pkgVersion version of module
 * @param {string} params.moduleName module name
 * @param {object} params.instrumentation hooks for a give module
 * @returns {object} updated xport module
 */
function loadInstrumentation({
  shim,
  resolvedNodule,
  pkgVersion,
  moduleName,
  nodule,
  instrumentation
}) {
  try {
    if (instrumentation.onRequire(shim, resolvedNodule, moduleName) !== false) {
      nodule = shim.getExport(nodule)
      instrumentation[symbols.instrumented].add(pkgVersion)
    }
  } catch (instrumentationError) {
    instrumentation[symbols.instrumentedErrored].add(pkgVersion)
    if (instrumentation.onError) {
      try {
        instrumentation.onError(instrumentationError)
      } catch (e) {
        logger.warn(
          e,
          instrumentationError,
          'Custom instrumentation for %s failed, then the onError handler threw an error',
          moduleName
        )
      }
    } else {
      logger.warn(
        instrumentationError,
        'Custom instrumentation for %s failed. Please report this to the ' +
          'maintainers of the custom instrumentation.',
        moduleName
      )
    }
  }

  return nodule
}

function _firstPartyInstrumentation(agent, fileName, shim, nodule, moduleName) {
  const fullPath = path.resolve(fileName)
  if (!fs.existsSync(fileName)) {
    return logger.warn('Tried to load instrumentation from %s, but file does not exist', fullPath)
  }
  try {
    return require(fileName)(agent, nodule, moduleName, shim)
  } catch (error) {
    logger.warn(
      error,
      'Failed to instrument module %s using %s',
      path.basename(fileName, '.js'),
      fullPath
    )
  }
}

function _postLoad(agent, nodule, name, resolvedName, esmResolver) {
  const instrumentation = shimmer.getInstrumentationNameFromModuleName(name)
  const registeredInstrumentation = shimmer.registeredInstrumentations[instrumentation]
  const hasPostLoadInstrumentation =
    registeredInstrumentation &&
    registeredInstrumentation.length &&
    registeredInstrumentation.filter((hook) => hook.onRequire).length

  // Check if this is a known instrumentation and then run it.
  if (hasPostLoadInstrumentation) {
    // Add the basedir to the instrumentation to be used later to parse version from package.json
    registeredInstrumentation.basedir = resolvedName
    logger.trace('Instrumenting %s with onRequire (module loaded) hook.', name)
    return instrumentPostLoad(agent, nodule, instrumentation, resolvedName, esmResolver)
  }

  return nodule
}

function hasValidRegisterOptions(opts) {
  if (!opts) {
    logger.warn('Instrumentation registration failed, no options provided')
    return false
  }

  if (!opts.moduleName) {
    logger.warn(`Instrumentation registration failed, 'moduleName' not provided`)
    return false
  }

  if (!opts.onRequire) {
    logger.warn(
      'Instrumentation registration for %s failed, no require hooks provided.',
      opts.moduleName
    )

    return false
  }

  return true
}

/**
 * Adds metrics to indicate instrumentation was used for a particular module and
 * what major version the module was at, if possible.
 *
 * @param {*} agent The agent instance.
 * @param {*} shim The instance of the shim used to instrument the module.
 * @param {string} moduleName The name of the required module.
 * @param {string} metricPrefix Support metric prefix to prepend to the metrics. Will indicate onRequire
 *
 * from NAMES.FEATURES.INSTRUMENTATION.
 */
function trackInstrumentationUsage(agent, shim, moduleName, metricPrefix) {
  try {
    const version = tryGetVersion(shim)
    const instrumentationMetricName = `${metricPrefix}/${moduleName}`

    agent.metrics.getOrCreateMetric(instrumentationMetricName).incrementCallCount()

    if (version) {
      const majorVersion = semver.major(version)
      const versionMetricName = `${instrumentationMetricName}/Version/${majorVersion}`

      agent.metrics.getOrCreateMetric(versionMetricName).incrementCallCount()
    }
  } catch (error) {
    logger.debug('Unable to track instrumentation usage for: ', moduleName, error)
  }
}

function tryGetVersion(shim) {
  // Global module (i.e. domain) or finding root failed
  if (shim._moduleRoot === '/') {
    return
  }

  return shim.pkgVersion
}
