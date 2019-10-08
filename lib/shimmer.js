'use strict'

var path = require('path')
var fs = require('./util/unwrapped-core').fs
var logger = require('./logger').child({component: 'shimmer'})
var INSTRUMENTATIONS = require('./instrumentations')()
var properties = require('./util/properties')
var shims = require('./shim')
const { inject } = require('./injector')

var MODULE_TYPE = shims.constants.MODULE_TYPE

var CORE_INSTRUMENTATION = {
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
 * All of the wrapped methods are tracked in this variable and used by unwrapAll
 * below.
 */
var instrumented = []

function applyDebugState(shimmer, shim, nodule) {
  if (shimmer.debug) {
    shim.enableDebug()
    instrumented.push(shim)
    instrumented.push({__NR_unwrap: function unwrapNodule() {
      delete nodule.__NR_instrumented
      delete nodule.__NR_shim
    }})
    nodule.__NR_shim = shim
  }
}

/**
 * All instrumentation files must export the same interface: a single
 * initialization function that takes the agent and the module to be
 * instrumented.
 */
function instrument(agent, nodule, moduleName, resolvedName) {
  var instrumentation = shimmer.registeredInstrumentations[moduleName]
  if (properties.hasOwn(nodule, '__NR_instrumented')) {
    logger.trace(
      'Already instrumented %s, skipping redundant instrumentation',
      moduleName
    )
    return nodule
  }


  var shim = shims.createShimFromType(
    instrumentation.type,
    agent,
    moduleName,
    resolvedName
  )

  applyDebugState(shimmer, shim, nodule)

  try {
    if (instrumentation.onRequire(shim, nodule, moduleName) !== false) {
      nodule = shim.getExport(nodule)
      nodule.__NR_instrumented = true
    }
  } catch (instrumentationError) {
    if (instrumentation.onError) {
      try {
        instrumentation.onError(instrumentationError)
      } catch (e) {
        logger.warn(
          e, instrumentationError,
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
  var fullPath = path.resolve(fileName)
  if (!fs.existsSync(fileName)) {
    return logger.warn(
      'Tried to load instrumentation from %s, but file does not exist',
      fullPath
    )
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

function _postLoad(agent, nodule, name, resolvedName) {
  var instrumentation
  instrumentation = shimmer.getInstrumentationNameFromModuleName(name)

  // Check if this is a known instrumentation and then run it.
  if (shimmer.registeredInstrumentations[instrumentation]) {
    logger.trace('Instrumenting %s.', name)
    return instrument(agent, nodule, instrumentation, resolvedName)
  }

  return nodule
}

var shimmer = module.exports = {
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
   * @param {function} fn - The function to look for a wrapper on.
   *
   * @return {bool} True if `fn` exists and has an attached original, else false.
   */
  isWrapped: function isWrapped(fn) {
    return !!(fn && fn.__NR_original)
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
   * @param {function} wrapper A generator that, when called, returns a
   *                           wrapped version of the original function.
   */
  wrapMethod: function wrapMethod(nodule, noduleName, methods, wrapper) {
    if (!methods) {
      return logger.warn(
        new Error(),
        "Must include a method name to wrap. Called from:"
      )
    }

    if (!noduleName) noduleName = '[unknown]'
    if (!Array.isArray(methods)) methods = [methods]

    methods.forEach(function cb_forEach(method) {
      var fqmn = noduleName + '.' + method

      if (!nodule) {
        return logger.debug("Can't wrap %s from nonexistent object.", fqmn)
      }

      if (!wrapper) {
        return logger.debug("Can't wrap %s without a wrapper generator.", fqmn)
      }

      var original = nodule[method]

      if (!original) return logger.trace("%s not defined, so not wrapping.", fqmn)
      if (original.__NR_unwrap) return logger.debug("%s already wrapped by agent.", fqmn)

      var wrapped = wrapper(original, method)
      Object.keys(original).forEach((key) => {
        wrapped[key] = original[key]
      })
      wrapped.__NR_original = original
      wrapped.__NR_unwrap = function __NR_unwrap() {
        nodule[method] = original
        logger.trace("Removed instrumentation from %s.", fqmn)
      }

      nodule[method] = wrapped
      if (shimmer.debug) instrumented.push(wrapped)
      logger.trace("Instrumented %s.", fqmn)
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
   * @param {function} options    Optional getter and setter to use for the accessor.
   *
   * @returns {object} The original value of the property.
   */
  wrapDeprecated: function wrapDeprecated(nodule, noduleName, property, options) {
    if (!property) {
      logger.warn(new Error(), "Must include a function name to wrap. Called from:")
      return
    }

    if (!noduleName) noduleName = '[unknown]'

    var fqmn = noduleName + '.' + property
    if (!nodule) {
      logger.debug("Can't wrap %s from nonexistent object.", fqmn)
      return
    }

    var original = nodule[property]
    if (!original) {
      logger.trace("%s not defined, so not wrapping.", fqmn)
      return
    }

    delete nodule[property]

    var descriptor = {
      configurable: true,
      enumerable: true
    }
    if (options.get) descriptor.get = options.get
    if (options.set) descriptor.set = options.set
    Object.defineProperty(nodule, property, descriptor)
    logger.trace("Instrumented %s.", fqmn)

    if (shimmer.debug) {
      instrumented.push({
        __NR_unwrap: function unwrapDeprecated() {
          delete nodule[property]
          nodule[property] = original
        }
      })
    }

    return original
  },

  unwrapMethod: function unwrapMethod(nodule, noduleName, method) {
    if (!noduleName) noduleName = '[unknown]'
    if (!method) return logger.debug("Must include a method name to unwrap. " +
                                     "Called from: %s", new Error().stack)

    var fqmn = noduleName + '.' + method

    if (!nodule) {
      return logger.debug("Can't unwrap %s from nonexistent object.", fqmn)
    }

    var wrapped = nodule[method]

    // keep instrumented up to date
    var pos = instrumented.indexOf(wrapped)
    if (pos !== -1) instrumented.splice(pos, 1)

    if (!wrapped) return logger.debug("%s not defined, so not unwrapping.", fqmn)
    if (!wrapped.__NR_unwrap) return logger.debug("%s isn't unwrappable.", fqmn)

    wrapped.__NR_unwrap()
  },

  unwrapAll: function unwrapAll() {
    instrumented.forEach(function cb_forEach(wrapper) {
      wrapper.__NR_unwrap()
    })
    instrumented = []
  },

  /**
   * Patch the module.load function so that we see modules loading and
   * have an opportunity to patch them with instrumentation.
   */
  patchModule: function patchModule(agent) {
    logger.trace("Wrapping module loader.")
    var Module = require('module')
    var filepathMap = {}

    // TODO: how do we unpatch this?
    const diagConf = agent.config.diagnostics.code_injector
    if (diagConf.enabled) {
      // XXX: this is required to handle unwrapping event listener removal
      const EEProto = require('events').EventEmitter.prototype
      shimmer.wrapMethod(
        EEProto,
        'EventEmitter.prototype',
        ['addListener', 'on', 'once', 'off', 'prependListener', 'prependOnceListener'],
        function wrapAddListener(addListener) {
          return function wrappedAddListener(ev, listener) {
            return addListener.call(this, ev, __NR_unwrap(listener))
          }
        }
      )
      shimmer.wrapMethod(
        EEProto,
        'EventEmitter.prototype',
        'removeListener',
        function wrapRemoveListener(removeListener) {
          return function wrappedRemoveListener(ev, listener) {
            return removeListener.call(this, ev, __NR_unwrap(listener))
          }
        }
      )
      const internalCodePattern = diagConf.internal_file_pattern
      const proto = Module.prototype
      shimmer.wrapMethod(
        proto,
        'Module.prototype',
        '_compile',
        function wrapCompile(_compile) {
          return function wrappedCompile(code, file) {
            let injected
            try {
              injected = internalCodePattern.test(file) ? code : inject(code, file)
              return _compile.call(this, injected, file)
            } catch (e) {
              logger.debug('Unable to parse file:', file, e)
              return _compile.call(this, code, file)
            }
          }
        }
      )

      // TODO: use shimmer methods
      global.tracer = agent.tracer
      global.__NR_wrap = __NR_wrap
      function __NR_wrap(f, lineNum, fileName) {
        const scheduledSegment = agent.tracer.getSegment()
        if (
          typeof f !== 'function' ||
          !scheduledSegment ||
          !scheduledSegment.transaction.isActive()
        ) {
          return f
        }


        const scheduledTransaction = scheduledSegment.transaction
        return new Proxy(f, {
          get: function getTrap(target, prop) {
            // Allow for look up of the target
            if (prop === '__NR_new_original') {
              return target
            }
            return target[prop]
          },
          construct: function constructTrap(Target, proxyArgs) {
            const currentSegment = agent.tracer.getSegment()
            if (
              scheduledTransaction.isActive() &&
              (
                !currentSegment ||
                currentSegment.transaction.id !== scheduledTransaction.id
              )
            ) {
              logger.info(
                `lost state in ${fileName} (line ${lineNum});`,
                `expected to be in transaction ${scheduledTransaction.id},`,
                `instead landed in ${currentSegment && currentSegment.transaction.id}`
              )
            }
            return new Target(...proxyArgs)
          },
          apply: function wrappedApply(target, thisArg, args) {
            const currentSegment = agent.tracer.getSegment()
            if (
              scheduledTransaction.isActive() &&
              (
                !currentSegment ||
                currentSegment.transaction.id !== scheduledTransaction.id
              )
            ) {
              logger.info(
                `lost state in ${fileName} (line ${lineNum});`,
                `expected to be in transaction ${scheduledTransaction.id},`,
                `instead landed in ${currentSegment && currentSegment.transaction.id}`
              )
            }
            return target.apply(thisArg, args)
          }
        })
      }

      global.__NR_unwrap = __NR_unwrap
      function __NR_unwrap(f) {
        if (typeof f !== 'function' || !f || !f.__NR_new_original) {
          return f
        }

        return f.__NR_new_original
      }
    }

    shimmer.wrapMethod(Module, 'Module', '_resolveFilename', function wrapRes(resolve) {
      return function wrappedResolveFilename(file) {
        // This is triggered by the load call, so record the path that has been seen so
        // we can examine it after the load call has returned.
        const resolvedFilepath = resolve.apply(this, arguments)
        filepathMap[file] = resolvedFilepath
        return resolvedFilepath
      }
    })

    shimmer.wrapMethod(Module, 'Module', '_load', function wrapLoad(load) {
      return function wrappedLoad(file) {
        // Because we can only observe the call and return of the load function, and the
        // load function calls resolve, we must mirror the recursive load calls with a
        // stack.
        const m = load.apply(this, arguments)
        return _postLoad(agent, m, file, filepathMap[file])
      }
    })
  },

  unpatchModule: function unpatchModule() {
    logger.trace("Unwrapping to previous module loader.")
    var Module = require('module')

    shimmer.unwrapMethod(Module, 'Module', '_resolveFilename')
    shimmer.unwrapMethod(Module, 'Module', '_load')
  },

  bootstrapInstrumentation: function bootstrapInstrumentation(agent) {
    // Instrument global.
    const globalShim = new shims.Shim(agent, 'globals', 'globals')
    applyDebugState(shimmer, globalShim, global)
    var globalsFilepath = path.join(__dirname, 'instrumentation', 'core', 'globals.js')
    _firstPartyInstrumentation(agent, globalsFilepath, globalShim, global, 'globals')

    // Instrument each of the core modules.
    Object.keys(CORE_INSTRUMENTATION).forEach(function forEachCore(mojule) {
      const core = CORE_INSTRUMENTATION[mojule]
      const filePath = path.join(__dirname, 'instrumentation', 'core', core.file)
      let uninstrumented = null

      try {
        uninstrumented = require(mojule)
      } catch (err) {
        logger.trace(
          'Could not load core module %s got error %s',
          mojule,
          err
        )
      }

      const shim = shims.createShimFromType(core.type, agent, mojule, mojule)
      applyDebugState(shimmer, shim, core)
      _firstPartyInstrumentation(agent, filePath, shim, uninstrumented, mojule)
    })

    // Register all the first-party instrumentations.
    Object.keys(INSTRUMENTATIONS).forEach(function forEachInstrumentation(moduleName) {
      var instrInfo = INSTRUMENTATIONS[moduleName]
      if (instrInfo.module) {
        // Because external instrumentations can change independent of
        // the agent core, we don't want breakages in them to entirely
        // disable the agent.
        try {
          var hooks = require(instrInfo.module + '/nr-hooks')
          hooks.forEach(shimmer.registerInstrumentation)
        } catch (e) {
          logger.warn('Failed to load instrumentation for ' + instrInfo.module, e)
          return
        }
      } else if (moduleName === 'amqplib') {
        // TODO: Remove this code when amqplib instrumentation is made external.
        require('./instrumentation/amqplib').selfRegister(shimmer)
      } else {
        var fileName = path.join(__dirname, 'instrumentation', moduleName + '.js')
        shimmer.registerInstrumentation({
          moduleName: moduleName,
          type: instrInfo.type,
          onRequire: _firstPartyInstrumentation.bind(null, agent, fileName)
        })
      }
    })

    // Even though domain is a core module we add it as a registered
    // instrumentation to be lazy-loaded because we do not want to cause domain
    // usage.
    var domainPath = path.join(__dirname, 'instrumentation/core/domain.js')
    shimmer.registerInstrumentation({
      moduleName: 'domain',
      type: null,
      onRequire: _firstPartyInstrumentation.bind(null, agent, domainPath)
    })
  },

  registerInstrumentation: function registerInstrumentation(opts) {
    shimmer.registeredInstrumentations[opts.moduleName] = opts
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
   */
  reinstrument: function reinstrument(agent, modulePath) {
    return _postLoad(agent, require(modulePath), modulePath)
  },

  /**
   * Given a NodeJS module name, return the name/identifier of our
   * instrumentation.  These two things are usually, but not always,
   * the same.
   */
  getInstrumentationNameFromModuleName(moduleName) {
    var instrumentation
    // XXX When updating these special cases, also update `uninstrumented`.
    // To allow for instrumenting both 'pg' and 'pg.js'.
    if (moduleName === 'pg.js') {
      instrumentation = 'pg'
    } if (moduleName === 'mysql2') {
      // mysql2 (https://github.com/sidorares/node-mysql2) is a drop in replacement for
      // mysql which conforms to the existing mysql API. If we see mysql2, treat it as
      // mysql
      instrumentation = 'mysql'
    } else {
      instrumentation = moduleName
    }
    return instrumentation
  }
}
