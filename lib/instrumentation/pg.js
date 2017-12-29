'use strict'

function getQuery(shim, original, name, args) {
  var config = args[0]
  var statement
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
      shim.wrapClass(pg, 'Pool', {post: poolPostConstructor, es6: true})
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
    shim.recordQuery(this, 'query', {
      callback: shim.LAST,
      query: getQuery,
      stream: 'row',
      parameters: getInstanceParameters(shim, this),
      internal: false
    })

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
  var origGetter = pgsql.__lookupGetter__('native')
  if (origGetter) {
    delete pgsql.native
    pgsql.__defineGetter__('native', function getNative() {
      var temp = origGetter()
      if (temp != null) {
        instrumentPGNative(temp)
      }
      return temp
    })
  }

  // wrapping for JS
  shim.recordQuery(
    pgsql && pgsql.Client && pgsql.Client.prototype,
    'query',
    function wrapJSClientQuery(shim) {
      return {
        callback: shim.LAST,
        query: getQuery,
        stream: 'row',
        parameters: getInstanceParameters(shim, this),
        internal: false
      }
    }
  )
}

function getInstanceParameters(shim, client) {
  return {
    host: client.host || null,
    port_path_or_id: client.port || null,
    database_name: client.database || null
  }
}
