/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const semver = require('semver')

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
  const pgVersion = shim.require('./package.json').version

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
    if (semver.satisfies(pgVersion, '>=7.0.0') && typeof queryArgs[0] === 'string') {
      return {
        callback: shim.LAST,
        query: getQuery,
        promise: true,
        parameters: getInstanceParameters(shim, this),
        internal: false
      }
    }

    return {
      callback: shim.LAST,
      query: getQuery,
      stream: 'row',
      parameters: getInstanceParameters(shim, this),
      internal: false
    }
  }

  // wrapping for native
  function instrumentPGNative(pg) {
    shim.wrapReturn(pg, 'Client', clientFactoryWrapper)
    shim.wrapReturn(pg.pools, 'Client', clientFactoryWrapper)

    // In pg v5 the Client class used by pg-pool is the same Client
    // class as pg.Client.  Since querying through the Pool class just
    // defers to Client.query in this case we should skip instrumenting
    // the Client class on Pool.
    // Note: pg v5 was the only version to have both the Pool
    // constructor and pg.pools so we can check against pg.pools to only
    // instrument pg.Pool on v6 and later.
    if (!pg.pools) {
      shim.wrapClass(pg, 'Pool', { post: poolPostConstructor, es6: true })
    }
  }

  function poolPostConstructor(shim) {
    if (!shim.isWrapped(this.Client)) {
      shim.wrapClass(this, 'Client', clientPostConstructor)
    }
  }

  function clientFactoryWrapper(shim, fn, fnName, client) {
    clientPostConstructor.call(client, shim)
  }

  function clientPostConstructor(shim) {
    shim.recordQuery(this, 'query', wrapJSClientQuery)

    shim.record(this, 'connect', function pgConnectNamer() {
      return {
        name: 'connect',
        callback: shim.LAST
      }
    })
  }

  // The pg module defines "native" getter which sets up the native client lazily
  // (only when called).  We replace the getter, so that we can instrument the native
  // client.  The original getter replaces itself with the instance of the native
  // client, so only instrument if the getter exists (otherwise assume already
  // instrumented).
  const origGetter = pgsql.__lookupGetter__('native')
  if (origGetter) {
    delete pgsql.native
    pgsql.__defineGetter__('native', function getNative() {
      const temp = origGetter()
      if (temp != null) {
        instrumentPGNative(temp)
      }
      return temp
    })
  }

  // wrapping for JS
  shim.recordQuery(pgsql && pgsql.Client && pgsql.Client.prototype, 'query', wrapJSClientQuery)
}

function getInstanceParameters(shim, client) {
  return {
    host: client.host || null,
    port_path_or_id: client.port || null,
    database_name: client.database || null
  }
}
