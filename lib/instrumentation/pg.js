/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { nrEsmProxy } = require('../symbols')
const { RecorderSpec, QuerySpec, ClassWrapSpec } = require('../shim/specs')
const DatastoreParameters = require('../shim/specs/params/datastore')

function getQuery(shim, original, name, args) {
  const config = args[0]
  let statement
  if (config && (typeof config === 'string' || config instanceof String)) {
    statement = config
  } else if (config && config.text) {
    statement = config.text
  } else {
    // Won't be matched by parser, but should be handled properly
    statement = 'Other'
  }
  return statement
}

module.exports = function initialize(agent, pgsql, moduleName, shim) {
  shim.setDatastore(shim.POSTGRES)

  // allows for native wrapping to not happen if not necessary
  // when env var is true
  if (process.env.NODE_PG_FORCE_NATIVE) {
    return instrumentPGNative(pgsql)
  }

  function wrapJSClientQuery(shim, _, __, queryArgs) {
    // As of pg v7.0.0, Client.query returns a Promise from an async call.
    // pg supports event based Client.query when a Query object is passed in,
    // and works similarly in pg version <7.0.0
    if (typeof queryArgs[0] === 'string') {
      return new QuerySpec({
        callback: shim.LAST,
        query: getQuery,
        promise: true,
        parameters: getInstanceParameters(shim, this),
        internal: false
      })
    }

    return new QuerySpec({
      callback: shim.LAST,
      query: getQuery,
      stream: 'row',
      parameters: getInstanceParameters(shim, this),
      internal: false
    })
  }

  // wrapping for native
  function instrumentPGNative(pg) {
    shim.wrapReturn(pg, 'Client', clientFactoryWrapper)
    shim.wrapClass(pg, 'Pool', new ClassWrapSpec({ post: poolPostConstructor, es6: true }))
  }

  function poolPostConstructor(shim) {
    if (!shim.isWrapped(this.Client)) {
      shim.wrapClass(this, 'Client', new ClassWrapSpec({ post: clientPostConstructor }))
    }
  }

  function clientFactoryWrapper(shim, fn, fnName, client) {
    clientPostConstructor.call(client, shim)
  }

  function clientPostConstructor(shim) {
    shim.recordQuery(this, 'query', wrapJSClientQuery)

    shim.record(this, 'connect', function pgConnectNamer() {
      return new RecorderSpec({
        name: 'connect',
        callback: shim.LAST
      })
    })
  }

  updateNative(pgsql, instrumentPGNative)

  // wrapping for JS
  shim.recordQuery(pgsql && pgsql.Client && pgsql.Client.prototype, 'query', wrapJSClientQuery)
}

/**
 * Determines if the `pg` module is a plain CJS module or a CJS module that
 * has been imported via ESM's import. After making the determination, it will
 * update the `native` export of the module to be instrumented.
 *
 * @param {object} pg The module to inspect.
 * @param {Function} instrumentPGNative A function that will apply instrumentation
 * to the `native` export.
 */
function updateNative(pg, instrumentPGNative) {
  if (pg[nrEsmProxy] === true) {
    // When pg is imported via an ESM import statement, then our proxy will
    // make our non-ESM native getter wrapper not work correctly. Basically,
    // the getter will get evaluated by the proxy, and we never gain access to
    // replace the getter with our own implementation. Luckily, we get to
    // simplify in this scenario.
    const native = pg.default.native
    if (native !== null) {
      instrumentPGNative(native)
    }
  } else {
    // The pg module defines a "native" getter which sets up the native client lazily
    // (only when called).  We replace the getter, so that we can instrument the native
    // client.  The original getter replaces itself with the instance of the native
    // client, so only instrument if the getter exists (otherwise assume already
    // instrumented).
    const origGetter = pg.__lookupGetter__('native')
    if (origGetter) {
      delete pg.native
      pg.__defineGetter__('native', function getNative() {
        const temp = origGetter()
        if (temp != null) {
          instrumentPGNative(temp)
        }
        return temp
      })
    }
  }
}

function getInstanceParameters(shim, client) {
  return new DatastoreParameters({
    host: client.host || null,
    port_path_or_id: client.port || null,
    database_name: client.database || null
  })
}
