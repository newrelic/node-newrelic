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
const CORE_INSTRUMENTATION = require('./core-instrumentation')
const shims = require('./shim')
const { Hook } = require('require-in-the-middle')
const IitmHook = require('import-in-the-middle')
const { nrEsmProxy } = require('./symbols')
const isAbsolutePath = require('./util/is-absolute-path')
const InstrumentationDescriptor = require('./instrumentation-descriptor')
const InstrumentationTracker = require('./instrumentation-tracker')
const NAMES = require('./metrics/names')
const INSTRUMENTATION_TRACKING_PREFIX = NAMES.FEATURES.INSTRUMENTATION.ON_REQUIRE
const symbols = require('./symbols')
const subscriptions = require('./subscriber-configs')
const createSubscriberConfigs = require('./subscribers/create-config')
const ModulePatch = require('@apm-js-collab/tracing-hooks')
const getPackageVersion = require('./util/get-package-version')
const trackingPkgs = require('./tracking-packages')
let pkgsToHook = []

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

    for (const method of methods) {
      const fqmn = noduleName + '.' + method

      if (!nodule || !wrapper) {
        logger.debug("Can't wrap %s from nonexistent object or without a wrapper.", fqmn)
        continue
      }

      const original = nodule[method]

      if (!original || original[symbols.unwrap]) {
        logger.trace('%s not defined or already wrapped, so not wrapping.', fqmn)
        continue
      }

      const wrapped = wrapper(original, method)
      for (const [key, value] of Object.entries(original)) {
        wrapped[key] = value
      }
      wrapped[symbols.original] = original
      wrapped[symbols.unwrap] = function unwrap() {
        nodule[method] = original
        logger.trace('Removed instrumentation from %s.', fqmn)
      }

      nodule[method] = wrapped
      if (shimmer.debug) {
        instrumented.push(wrapped)
      }
      logger.trace('Instrumented %s.', fqmn)
    }
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
    for (const wrapper of instrumented) {
      wrapper[symbols.unwrap]()
    }
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
      if (agent.config.instrumentation?.[moduleName]?.enabled === false) {
        logger.warn(
          `Instrumentation for ${moduleName} has been disabled via 'config.instrumentation.${moduleName}.enabled. Not instrumenting package`
        )
      } else if (instrInfo.module) {
        // Because external instrumentations can change independent of
        // the agent core, we don't want breakages in them to entirely
        // disable the agent.
        try {
          const hooks = require(instrInfo.module + '/nr-hooks')
          for (const hook of hooks) {
            shimmer.registerInstrumentation(hook)
          }
        } catch (e) {
          logger.warn('Failed to load instrumentation for ' + instrInfo.module, e)
          return
        }
      } else {
        const fileName = path.join(__dirname, 'instrumentation', moduleName + '.js')
        shimmer.registerInstrumentation({
          moduleName,
          type: instrInfo.type,
          onRequire: _firstPartyInstrumentation.bind(null, agent, fileName)
        })
      }
    }

    // Even though domain is a core module we add it as a registered
    // instrumentation to be lazy-loaded because we do not want to cause domain
    // usage.
    instrumentDomain(agent)
  },

  /**
   * Registers all instrumentation for Node.js core libraries.
   *
   * @param {object} agent NR agent
   */
  registerCoreInstrumentation(agent) {
    instrumentProcessMethods(agent)

    // Instrument each of the core modules.
    for (const [mojule, core] of Object.entries(CORE_INSTRUMENTATION)) {
      if (agent.config.instrumentation?.[mojule].enabled === false) {
        logger.warn(
            `Instrumentation for ${mojule} has been disabled via 'config.instrumentation.${mojule}.enabled. Not instrumenting package`
        )
      } else if (core.file) {
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
    }
  },

  registerHooks(agent) {
    // add the packages from the subscriber based instrumentation
    // this is only added to add tracking metrics
    Array.prototype.push.apply(pkgsToHook, trackingPkgs)
    this._ritm = new Hook(pkgsToHook, function onHook(exports, name, basedir) {
      return _postLoad(agent, exports, name, basedir)
    })
    this._iitm = new IitmHook(pkgsToHook, function onESMHook(exports, name, basedir) {
      return _postLoad(agent, exports, name, basedir, true)
    })
  },

  removeHooks(agent) {
    if (this._ritm) {
      this._ritm.unhook()
      this._ritm = null
    }

    if (this._iitm) {
      this._iitm.unhook()
      this._iitm = null
    }

    pkgsToHook = []
    if (agent?.config?.opentelemetry?.enabled === true) {
      // We must lazy load the method in order to support stripping of the
      // `@opentelemetry` packages for slim builds.
      require('./otel/setup').teardownOtel(agent)
    }
    if (this._subscribers) {
      shimmer.teardownSubscribers()
    }
    if (this._modulePatch) {
      this._modulePatch.unpatch()
    }
  },

  bootstrapInstrumentation: function bootstrapInstrumentation(agent) {
    const subscriberConfigs = createSubscriberConfigs(subscriptions)
    this._modulePatch = new ModulePatch(subscriberConfigs)
    this._modulePatch.patch()
    shimmer.registerCoreInstrumentation(agent)
    shimmer.registerThirdPartyInstrumentation(agent)
    shimmer.setupSubscribers(agent)
    if (agent?.config?.opentelemetry?.enabled === true) {
      // We must lazy load the method in order to support stripping of the
      // `@opentelemetry` packages for slim builds.
      require('./otel/setup').setupOtel(agent)
    }
  },

  registerInstrumentation: function registerInstrumentation(opts) {
    if (!hasValidRegisterOptions(opts)) {
      return
    }

    const registeredInstrumentation = shimmer.registeredInstrumentations.getAllByName(
      opts.moduleName
    )

    if (!registeredInstrumentation) {
      // In cases where a customer is trying to instrument a file
      // that is not within node_modules, they must provide the absolutePath
      // so require-in-the-middle can call our callback. the moduleName
      // still needs to be the resolved name so we can look up our instrumentation correctly
      const pkgHook = opts.absolutePath || opts.moduleName

      // not using a set because this is shared by reference
      // to allow custom instrumentation to be loaded after the
      // agent is bootstrapped
      if (!pkgsToHook.includes(pkgHook)) {
        pkgsToHook.push(pkgHook)
      }
    }

    shimmer.registeredInstrumentations.track(
      opts.moduleName,
      new InstrumentationDescriptor({ ...opts })
    )
  },

  registeredInstrumentations: new InstrumentationTracker(),

  setupSubscribers: function setupSubscribers(agent) {
    this._subscribers = {}
    for (const subscriberConfigList of Object.values(subscriptions)) {
      for (const subscriberConfig of subscriberConfigList) {
        const Subscriber = require(`./subscribers/${subscriberConfig.path}`)
        const subscriber = new Subscriber({ agent, logger })
        if (subscriber.enabled === false) {
          logger.debug(
            'Skipping subscriber %s because it is disabled in the config',
            subscriber.packageName
          )
          continue
        }

        subscriber.enable()
        subscriber.subscribe()
        this._subscribers[subscriber.id] = subscriber
      }
    }
  },

  teardownSubscribers: function teardownSubscribers() {
    for (const subscriber of Object.values(this._subscribers)) {
      subscriber.disable()
      subscriber.unsubscribe()
    }
    this._subscribers = {}
  },

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

    if (isAbsolutePath(moduleName) === true) {
      // moduleName is an absolute path to a module. So we need to look up
      // the simple name from the registered instrumentations.
      return this.registeredInstrumentations.simpleNameFromPath(moduleName)
    }

    return moduleName
  },

  /**
   * Checks all registered instrumentations for a module and returns true
   * only if every hook succeeded.
   *
   * @param {string} moduleName name of registered instrumentation
   * @param {object} resolvedName the fully resolve path to the module
   * @returns {boolean} if all instrumentation hooks successfully ran for a
   * module
   */
  isInstrumented(moduleName, resolvedName) {
    const allItems = shimmer.registeredInstrumentations.getAllByName(moduleName)
    const items = allItems.filter(
      (item) => item.instrumentation.resolvedName === resolvedName && item.meta.instrumented === true
    )
    return items.length === allItems.length
  },

  instrumentPostLoad(agent, module, moduleName, resolvedName, returnModule = false) {
    const result = _postLoad(agent, module, moduleName, resolvedName)
    // This is to not break the public API
    // previously it would just call instrumentation
    // and not check the result
    return returnModule ? result : shimmer.isInstrumented(moduleName, resolvedName)
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
 * @param {object} params to function
 * @param {object} params.agent NR agent
 * @param {object} params.nodule Class or module containing the function to wrap.
 * @param {string} params.moduleName name of module
 * @param {string} params.resolvedName fully qualified path to module
 * @param {boolean} params.esmResolver indicates if it came from esm loader
 * @param {string} params.pkgVersion version of package loading instrumentation
 * @returns {object|undefined} returns exported module unless already instrumented
 */
function instrumentPostLoad({ agent, nodule, moduleName, resolvedName, pkgVersion, esmResolver }) {
  const trackedInstrumentations = shimmer.registeredInstrumentations.getAllByName(moduleName)
  for (const trackedInstrumentation of trackedInstrumentations) {
    const isInstrumented = trackedInstrumentation.meta.instrumented === true
    const failedInstrumentation = trackedInstrumentation.meta.didError === true
    if (isInstrumented === true || failedInstrumentation === true) {
      const msg = isInstrumented ? 'Already instrumented' : 'Failed to instrument'
      logger.trace(`${msg} ${moduleName}@${pkgVersion}, skipping registering instrumentation`)
      continue
    }

    const { instrumentation } = trackedInstrumentation
    const resolvedNodule = resolveNodule({ nodule, instrumentation, esmResolver })
    const shim = shims.createShimFromType({
      type: instrumentation.type,
      agent,
      moduleName,
      resolvedName,
      shimName: instrumentation.shimName,
      pkgVersion
    })

    applyDebugState(shim, resolvedNodule, esmResolver)
    nodule = loadInstrumentation({
      shim,
      resolvedNodule,
      pkgVersion,
      moduleName,
      nodule,
      instrumentation
    })
  }

  return nodule
}

/**
 * If a module that is being shimmed was loaded via a typical `require` then
 * we can use it as normal. If was loaded via an ESM import, then we need to
 * handle it with some extra care. This function inspects the module,
 * the conditions around its loading, and returns an appropriate object for
 * subsequent shimming methods.
 *
 * @param {object} params Input parameters.
 * @param {object} params.nodule The nodule being instrumented.
 * @param {object} params.instrumentation The configuration for the nodule
 * to be instrumented.
 * @param {boolean|null} params.esmResolver Indicates if the nodule was loaded
 * via an ESM import.
 * @returns {object} The nodule or a Proxy.
 */
function resolveNodule({ nodule, instrumentation, esmResolver }) {
  if (instrumentation.isEsm === true || !esmResolver) {
    return nodule
  }

  // We have a CJS module wrapped by import-in-the-middle having been
  // imported through ESM syntax. Due to the way CJS modules are parsed by
  // ESM's import, we can have the same "export" attached to the `default`
  // export and as a top-level named export. In order to shim things such
  // that our users don't need to know to access `something.default.foo`
  // when they have done `import * as something from 'something'`, we need
  // to proxy the proxy in order to set our wrappers on both instances.
  const noduleDefault = nodule.default
  const origNodule = nodule
  return new Proxy(
    { origNodule, noduleDefault },
    {
      get(target, name) {
        if (name === nrEsmProxy) {
          return true
        }
        if (target.noduleDefault[name]) {
          return target.noduleDefault[name]
        }
        return target.origNodule[name]
      },
      set(target, name, value) {
        if (target.origNodule[name]) {
          target.origNodule[name] = value
        }
        if (target.noduleDefault[name]) {
          target.noduleDefault[name] = value
        }
        return true
      }
    }
  )
}

/**
 * Attempts to execute an onRequire hook for a given module.
 * If it fails it will call an onError hook and log warnings accordingly
 *
 * @param {object} params wrapping object to function
 * @param {*} params.shim The instance of the shim used to instrument the module.
 * @param {object} params.nodule Class or module containing the function to wrap.
 * @param {object} params.resolvedNodule returns export of the default property
 * @param {string} params.moduleName module name
 * @param {InstrumentationDescriptor} params.instrumentation hooks for a give module
 * @returns {object} updated export module
 */
function loadInstrumentation({ shim, resolvedNodule, moduleName, nodule, instrumentation }) {
  const trackedItem = shimmer.registeredInstrumentations.getTrackedItem(moduleName, instrumentation)
  try {
    if (instrumentation.onRequire(shim, resolvedNodule, moduleName) !== false) {
      shimmer.registeredInstrumentations.setHookSuccess(trackedItem)
      nodule = shim.getExport(nodule)
    }
  } catch (instrumentationError) {
    shimmer.registeredInstrumentations.setHookFailure(trackedItem)
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

/**
 * Invoked directly after a module is loaded via `require` (or `import`). This
 * is the first opportunity for us to work with the newly loaded module. Prior
 * to this, the only information we have is the simple name (the string used
 * to load the module), as well as the `onRequire` and `onError` hooks to
 * attach to the module.
 *
 * @param {object} agent agent instance
 * @param {object} nodule The newly loaded module.
 * @param {string} name The simple name used to load the module.
 * @param {string} resolvedName The full file system path to the module.
 * @param {object} [esmResolver] If the module was loaded via ESM
 * @returns {* | object | undefined} The instrumented module, or the original
 * @private
 */
function _postLoad(agent, nodule, name, resolvedName, esmResolver) {
  const simpleName = shimmer.getInstrumentationNameFromModuleName(name)
  const registeredInstrumentations = shimmer.registeredInstrumentations.getAllByName(simpleName)
  const hasPostLoadInstrumentation =
    registeredInstrumentations &&
    registeredInstrumentations.length &&
    registeredInstrumentations.filter((ri) => ri.instrumentation.onRequire).length

  if (resolvedName === undefined && isAbsolutePath(name) === true) {
    // `resolvedName` comes from the `basedir` returned by the `Hook`
    // function from import-in-the-middle or require-in-the-middle. At least
    // with IITM, if the path string does not include a `node_modules` then
    // `basedir` will be `undefined`. But we need it for our instrumentation
    // to work. We'll only reach this situation if the module being
    // instrumented has an `absolutePath` defined. So we detect that and
    // assign appropriately.
    resolvedName = name
  }

  let pkgVersion = null
  // check for resolvedName
  // core node libs lack this so we do not need to obtain package version
  if (resolvedName) {
    pkgVersion = getPackageVersion(resolvedName)
  }
  // this currently works because we add subscriber based instrumentation
  // and packages we want to track that are not instrumented to the `pkgsToHook`
  // array that get passed to require-in-the-middle and import-in-the-middle
  // if/once we removed reliance on those packages, we will have to subscribe to the
  // https://nodejs.org/api/diagnostics_channel.html#modules channels to see when
  // a module is required/imported and increment the metrics there
  trackInstrumentationUsage(agent, name, pkgVersion)

  // Check if this is a known instrumentation and then run it.
  if (hasPostLoadInstrumentation) {
    shimmer.registeredInstrumentations.setResolvedName(simpleName, resolvedName)
    logger.trace('Instrumenting %s with onRequire (module loaded) hook.', name)
    return instrumentPostLoad({ agent, nodule, moduleName: simpleName, resolvedName, pkgVersion, esmResolver })
  }

  return nodule
}

function hasValidRegisterOptions(opts) {
  if (!opts) {
    logger.warn('Instrumentation registration failed, no options provided')
    return false
  }

  if (!opts.moduleName) {
    logger.warn("Instrumentation registration failed, 'moduleName' not provided")
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
 * Creates the `Supportability/Features/Instrumentation/OnRequire/<packageName>`
 * and `Supportability/Features/Instrumentation/OnRequire/<packageName>/Version/<majorVersion>`
 * metrics to track the usage of an instrumented package.
 * @param {Agent} agent The agent instance.
 * @param {string} moduleName The name of the required module.
 * @param {string} version version of package
 */
function trackInstrumentationUsage(agent, moduleName, version) {
  try {
    // only save the package name not a file within package
    if (moduleName.startsWith('@')) {
      const split = moduleName.split('/')
      moduleName = `${split[0]}/${split[1]}`
    } else {
      moduleName = moduleName.split('/')[0]
    }
    const instrumentationMetricName = `${INSTRUMENTATION_TRACKING_PREFIX}/${moduleName}`

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

/**
 * Loads the instrumentation with `./lib/instrumentation/core/globals.js`
 * This instrumentation cannot be disabled by config at the moment as it just
 * handles logging errors for `uncaughtException` and `unhandledRejections`
 *
 * @param {Agent} agent the agent instance
 */
function instrumentProcessMethods(agent) {
  const globalShim = new shims.Shim(agent, 'globals', '.')
  applyDebugState(globalShim, global, false)
  const globalsFilepath = path.join(__dirname, 'instrumentation', 'core', 'globals.js')
  _firstPartyInstrumentation(agent, globalsFilepath, globalShim, global, 'globals')
}

function instrumentDomain(agent) {
  if (agent.config.instrumentation?.domain.enabled === false) {
    logger.warn('Instrumentation for domain has been disabled via `config.instrumentation.domain.enabled`. Not instrumenting package')
    return
  }
  const domainPath = path.join(__dirname, 'instrumentation/core/domain.js')
  shimmer.registerInstrumentation({
    moduleName: 'domain',
    type: null,
    onRequire: _firstPartyInstrumentation.bind(null, agent, domainPath)
  })
}
