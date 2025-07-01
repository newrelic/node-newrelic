/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const { create } = require('@apm-js-collab/code-transformer')
const Module = require('node:module')
const parse = require('module-details-from-path')
const getPackageVersion = require('./util/get-package-version')

class ModulePatch {
  constructor(subscribers = []) {
    this.instrumentator = create(subscribers)
    this.transformers = new Map()
    this.resolve = Module._resolveFilename
    this.compile = Module.prototype._compile
  }

  /**
   * Patches the Node.js module class methods that are responsible for resolving filePaths and compiling code.
   * If a module is found that has an instrumentator, it will transform the code before compiling it
   * with tracing channel methods.
   */
  patch() {
    const self = this
    Module._resolveFilename = function wrappedResolveFileName() {
      const resolvedName = self.resolve.apply(this, arguments)
      const resolvedModule = parse(resolvedName)
      if (resolvedModule) {
        const version = getPackageVersion(resolvedModule.basedir, resolvedModule.name) || '0.0.0'
        const transformer = self.instrumentator.getTransformer(resolvedModule.name, version, resolvedModule.path)
        if (transformer) {
          self.transformers.set(resolvedName, transformer)
        }
      }
      return resolvedName
    }

    Module.prototype._compile = function wrappedCompile(...args) {
      const [content, filename] = args
      if (self.transformers.has(filename)) {
        const transformer = self.transformers.get(filename)
        const transformedCode = transformer.transform(content, false)
        args[0] = transformedCode
        transformer.free()
      }

      return self.compile.apply(this, args)
    }
  }

  /**
   * Clears all the transformers and restores the original Module methods that were wrapped.
   * This is intended to be used in testing for cleaning up
   */
  unpatch() {
    this.transformers.clear()
    Module._resolveFilename = this.resolve
    Module.prototype._compile = this.compile
  }
}

module.exports = ModulePatch
