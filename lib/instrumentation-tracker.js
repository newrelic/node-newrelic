/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const InstrumentationDescriptor = require('./instrumentation-descriptor')

/**
 * @typedef {object} TrackedItemMeta
 * @property {boolean} instrumented Indicates if the instrumentation
 * has been successfully applied.
 * @property {boolean|undefined} didError Indicates if the instrumentation
 * application resulted in an error or not.
 */

/**
 * Represents tracked instrumentations in the {@link InstrumentationTracker}.
 *
 * @private
 */
class TrackedItem {
  /**
   * @type {InstrumentationDescriptor}
   */
  instrumentation

  /**
   * @type {TrackedItemMeta}
   */
  meta

  constructor(params) {
    this.instrumentation = params.instrumentation
    this.meta = params.meta
  }
}

/**
 * The instrumentation tracker is used to keep track of
 * {@link InstrumentationDescriptor} instances in relation to modules that
 * are being instrumented. The general process looks like:
 *
 * 1. We register an instrumentation with a simple name like `pino`. This
 * "instrumentation" includes things like the `onRequire` and `onError`
 * callbacks. In this context, "instrumentation" and "hook" are interchangeable
 * terms.
 *
 * 2. Upon `require(<simple_name>)`, we hit `shimmer._postLoad` which will give
 * us the fully resolved path to the module being loaded.
 *
 * 3. `_postLoad` will utilize the previously registered instrumentation
 * information to determine if there are any callbacks for the module being
 * loaded. If so, it will attempt to run the callbacks.
 *
 * 4. At this point we need to keep track of which simple name + fully resolved
 * path has callbacks associated with it, and if the error callback was invoked.
 * When a subsequent load of the same simple name + fully resolved path
 * combination is encountered, we need to append that to the tracked hooks.
 * Or, if the previous hook failed, provide a way for the loading algorithm
 * to learn about that so that it can skip doing unnecessary work.
 *
 * The `InstrumentationTracker` object provides utility methods to facilitate
 * that process.
 *
 * @private
 */
class InstrumentationTracker {
  #tracked = new Map()

  get [Symbol.toStringTag]() {
    return 'InstrumentationTracker'
  }

  /**
   * Get all tracked instrumentations for the named module.
   *
   * @param {string} moduleName The simple name for the module, e.g. "pino".
   *
   * @returns {TrackedItem[]} All tracked items for the module.
   */
  getAllByName(moduleName) {
    return this.#tracked.get(moduleName)
  }

  /**
   * Get a specific tracked item for a module. This allows the
   * {@link setHookSuccess} and {@link setHookFailure} methods to be used.
   *
   * @param {string} moduleName The simple name for the module, e.g. "pino".
   * @param {InstrumentationDescriptor} instrumentation The instrumentation
   * descriptor that is contained within the tracked item.
   *
   * @returns {TrackedItem|undefined} The full tracked item that includes the
   * passed in descriptor along with the metadata about the instrumentation.
   */
  getTrackedItem(moduleName, instrumentation) {
    const items = this.getAllByName(moduleName)
    for (const item of items) {
      /* istanbul ignore else */
      if (item.instrumentation === instrumentation) {
        return item
      }
    }
  }

  /**
   * The primary entrypoint to the tracker. It registers the basic information
   * about an instrumentation prior to the to-be-instrumented module being
   * loaded. If this method is not used first, other methods will throw because
   * they will not be able to find any tracked items.
   *
   * @param {string} moduleName The simple name of the module being
   * instrumented, e.g. "pino". That is, whatever is passed to the `require`
   * function.
   * @param {InstrumentationDescriptor} instrumentation The initial descriptor
   * for the module being instrumented.
   */
  track(moduleName, instrumentation) {
    const tracked = this.#tracked.get(moduleName)
    if (tracked === undefined) {
      this.#tracked.set(moduleName, [
        new TrackedItem({ instrumentation, meta: { instrumented: false, didError: undefined } })
      ])
      return
    }

    let found
    for (const t of tracked) {
      if (t.instrumentation.instrumentationId === instrumentation.instrumentationId) {
        return
      }
    }
    /* istanbul ignore else */
    if (found === undefined) {
      tracked.push(
        new TrackedItem({ instrumentation, meta: { instrumented: false, didError: undefined } })
      )
    }
  }

  /**
   * Update the metadata for a tracked item to indicate that the hook failed.
   *
   * @param {TrackedItem} trackedItem The item to update.
   */
  setHookFailure(trackedItem) {
    trackedItem.meta.instrumented = false
    trackedItem.meta.didError = true
  }

  /**
   * Update the metadata for a tracked item to indicate that the hook succeeded.
   *
   * @param {TrackedItem} trackedItem The item to update.
   */
  setHookSuccess(trackedItem) {
    trackedItem.meta.instrumented = true
    trackedItem.meta.didError = false
  }

  /**
   * After a module has been loaded, via `require` or `import`, the tracked
   * instrumentation for that module must have its `resolvedName` property
   * updated. The `resolvedName` is used to uniquely identify instances of the
   * module. Being able to uniquely identify instances is crucial to being able
   * to instrument all loaded instances.
   *
   * @param {string} moduleName The simple name of the module, e.g. "pino".
   * @param {string} resolvedName The fully resolved file system path to the
   * module instance, e.g. "/opt/app/node_modules/pino".
   *
   * @throws {Error} If the provided `moduleName` is not present in the tracker.
   */
  setResolvedName(moduleName, resolvedName) {
    const items = this.#tracked.get(moduleName)
    if (items === undefined) {
      throw Error(`module not tracked: ${moduleName}`)
    }

    const missingResolvedName = []
    for (const item of items) {
      if (item.instrumentation.resolvedName === undefined) {
        missingResolvedName.push(item)
      } else if (item.instrumentation.resolvedName === resolvedName) {
        // We already have this specific instance of the module tracked.
        // So we don't need to do anything.
        return
      }
    }

    // eslint-disable-next-line sonarjs/no-small-switch
    switch (missingResolvedName.length) {
      case 0: {
        // We have encountered a new instance of the module. Therefore, we
        // need to clone an existing instrumentation, but apply a different
        // `resolvedName` to it.
        //
        // This happens when there is a dependency tree like:
        // + `/opt/app/node_modules/foo`
        // + `/opt/app/node_modules/transitive-dep/node_modules/foo`
        const item = items[0]
        this.track(
          moduleName,
          new InstrumentationDescriptor({ ...item.instrumentation, resolvedName })
        )
        break
      }

      default: {
        // Add the same name to all found instrumentations. This definitely
        // happens when the security agent is enabled.
        missingResolvedName.forEach((item) => {
          item.instrumentation.resolvedName = resolvedName
        })
      }
    }
  }

  /**
   * Given a full absolute path to a module, look up the instrumentation
   * associated with it and return the name for that instrumentation.
   *
   * @param {string} modulePath The path to the module being instrumented.
   *
   * @returns {string|undefined} The name of the module.
   */
  simpleNameFromPath(modulePath) {
    for (const [key, items] of this.#tracked.entries()) {
      const instrumentation = items.find((i) => i.instrumentation.absolutePath === modulePath)
      if (instrumentation) {
        return key
      }
    }
  }
}

module.exports = InstrumentationTracker
