
# Module Instrumentations

An instrumentation allows us to run some code immediately after a Node.js program loads a specific module via the `require` function. This code can then "wrap" (i.e redefine, "monkey-patch", etc.) module methods in order to to create metrics, events, segments, whatever-else, etc. as needed. An instrumentation also uses helper objects called "shims". The methods on these shims can perform tasks that are shared across different sorts of instrumentations, (naming a transaction, creating a segment, etc.).

There are three broad and overlapping categories of instrumentations.

1. Core Instrumentations
2. First Party Internal Instrumentations
3. First Party External instrumentations

Core instrumentations instrument modules provided by the core Node.js system. (ex. 'http')

First party instrumentations instrument modules that don't ship with core Node.js (ex. 'express'), and usually come from npm packages. An internal first party instrumentation's code lives inside the agent. An external first party instrumentation lives as a stand alone npm package.

This document will describe the mechanics of all three.

## Configuring an Instrumentation

We'll start with configuring an instrumentation. When we configure an instrumentation, we need to tell the agent

1. The module we want to instrument
2. Where our instrumentation module is located
3. The "type" of our instrumentation

Configuration details vary slightly across the three broad categories of instrumentations.

### Configuring Core Instrumentation

A core instrumentation is configured via the [CORE_INSTRUMENTATION object in the the shimmer module](https://github.com/newrelic/node-newrelic/blob/main/lib/shimmer.js#L17).

```js
var CORE_INSTRUMENTATION = {
  child_process: {
    type: MODULE_TYPE.GENERIC,
    file: 'child_process.js'
  },
  [module_to_instrument]: {
    type: MODULE_TYPE.[type],
    file: 'instrumentation-module-file'
  }, etc...
```

Each key in the `CORE_INSTRUMENTATION` object names the internal Node.js module we want to instrument. This configuration

```js
child_process: {
  /* ... */
},
```

will instrument the [child_process module](https://nodejs.org/api/child_process.html). The inner object contains the instrumentation's configuration.

```js
{
  type: MODULE_TYPE.GENERIC,
  file: 'child_process.js'
},
 ```

The 'file' key tells the agent which file contains our instrumentation module, and assumes a base folder of `lib/instrumentation/core`. This means our instrumentation module for the child_process module is located at [`lib/instrumentation/core/child_process.js`](https://github.com/newrelic/node-newrelic/blob/main/lib/instrumentation/core/child_process.js).

The 'type' key tells the agent the instrumentation's type. An instrumentation's type controls the sort of shim object our instrumentation module will receive. We'll cover that momentarily.

### Configuring First Party Instrumentations

First party instrumentations are configured via the function exported by the agent-local [instrumentations module](https://github.com/newrelic/node-newrelic/blob/main/lib/instrumentations.js).

```js
module.exports = function instrumentations() {
  return {
    /* internal instrumentation */
    'express': {type: MODULE_TYPE.WEB_FRAMEWORK},
    'module-name': {type: MODULE_TYPE.[type]},

    /* external instrumentation */
    'koa': {module: '@newrelic/koa'},
    'module-name': {module: 'npm-module-name'},
  }
}
```

As mentioned, there are *internal* and *external* first party instrumentations. For both type of instrumentation, the `key` of the returned object is the name of the module to instrument. The above instrumentations instrument [express](https://www.npmjs.com/package/express) and [koa](https://www.npmjs.com/package/koa), respectively.

However, the value object will differ depending on whether this is an internal or external instrumentation.

### First Party Internal Instrumentation Configuration

For internal instrumentations, you must provide a module 'type'.

```js
'express': {type: MODULE_TYPE.WEB_FRAMEWORK},
```

As with core instrumentations, this will determine the shim available to you in the instrumentation itself. You'll notice that, unlike core instrumentations, there's no file 'key'. For internal first party instrumentations the agent will automatically load a file based on the name of the module being instrumented. For example, the 'express' instrumentation will be loaded from the `lib/instrumentation/express.js` file.

### First Party External Instrumentation Configuration

For external instrumentations, there's no type to configure.

```js
'koa': {module: '@newrelic/koa'},
```

Instead, all you need to provide is an [npm package identifier](https://www.npmjs.com/package/@newrelic/koa). These external first party instrumentations are structured slightly differently from the internal ones.

We'll discuss the specifics of that in the next section.

## Creating the Instrumentation

Once you've configured your instrumentation, you'll need to create your instrumentation module.

Core instrumentations and *internal* first party instrumentations share the same format. First party external/npm-package based instrumentations use a different format. We'll start with the core and internal instrumentation format.

### Creating Core Instrumentations and Internal First Party Instrumentations

To create either a core instrumentations or internal first party instrumentations you'll need to

1. Create a javascript file for your instrumentation module
2. Have that module export a single function

Core instrumentations live in the `lib/instrumentation/core/` folder, and their file name is the one you configured in the `CORE_INSTRUMENTATION` object. For example, the configuration for the http module

```js
http: {
  type: MODULE_TYPE.TRANSACTION,
  file: 'http.js'
},
```

is configured with the filename `http.js`. This means the location of this instrumentation file will be `lib/instrumentation/core/http.js`.

First party instrumentations live in the `lib/instrumentation` folder, and will be automatically named based on the module being instrumented. For example, the express instrumentation

```js
module.exports = function instrumentations() {
  return {
    /* ... */
    'express': {type: MODULE_TYPE.WEB_FRAMEWORK},
    /* ... */
  }
}
```

can be found at `lib/instrumentation/express.js`.

In either case, an instrumentation module exports a single function, (named `initialize` by convention).

```js
module.exports = function initialize(agent, moduleToInstrument, moduleName, shim) {
  //your instrumentation code here
}
```

**`agent`**

This is a reference to the agent object

**`moduleToInstrument`**

This is a reference to the module that we're instrumenting, and that NodeJS just loaded.

**`moduleName`**

This is the name of the module that we're instrumenting, as a string.

**`shim`**

The type of the object in the shim variable depends on your instrumentation's type, and can be found in the [`SHIM_TYPE_MAP` object](https://github.com/newrelic/node-newrelic/blob/main/lib/shim/index.js).

```js
var SHIM_TYPE_MAP = Object.create(null)
SHIM_TYPE_MAP[MODULE_TYPE.GENERIC] = shims.Shim
SHIM_TYPE_MAP[MODULE_TYPE.CONGLOMERATE] = shims.ConglomerateShim
SHIM_TYPE_MAP[MODULE_TYPE.DATASTORE] = shims.DatastoreShim
SHIM_TYPE_MAP[MODULE_TYPE.MESSAGE] = shims.MessageShim
SHIM_TYPE_MAP[MODULE_TYPE.PROMISE] = shims.PromiseShim
SHIM_TYPE_MAP[MODULE_TYPE.TRANSACTION] = shims.TransactionShim
SHIM_TYPE_MAP[MODULE_TYPE.WEB_FRAMEWORK] = shims.WebFrameworkShim
```

### Creating External First Party Instrumentation

When you configure an external first party instrumentation, you provide an npm package identifier -- @newrelic/superagent below.

`'superagent': {module: '@newrelic/superagent'},`

These packages must have a top level Node.js module named nr-hooks. This nr-hooks module must be an array of objects.

```js
  module.exports = [{
  type: 'generic',
  moduleName: 'superagent',
  onRequire: require('./lib/instrumentation')
}]
```

Each object in this array configures a single instrumentation. The type is the same type as in core and internal first party instrumentations (configured via a raw string above, since these stand-alone instrumentations don't have access to the `MODULE_NAME` constant).

The 'moduleName' is the name of the module to be instrumented, and 'onRequire' loads an *external* instrumentation module.

This *external* instrumentation module is similar, **but not identical to**, the first party and core instrumentation modules. This module still needs to export a single function which will setup your instrumentation. However, this function only has two parameters

```js
module.exports = function instrument(shim, moduleToInstrument) {
  //wrap your methods and do your newrelic-y things here
}
```

The first, 'shim', is the same helper object used with core and first party internal modules. These are the same `SHIM_TYPE_MAP` shim objects, discussed above.

The second, 'moduleToInstrument', is a reference to the module object you want to instrument.

## The Special Case: amqp

As of this writing (April 15, 2019), there's one exception to everything in this document, and that's the [amqp instrumentation](https://github.com/newrelic/node-newrelic/blob/main/lib/instrumentation/amqplib.js).

There's a [special case](https://github.com/newrelic/node-newrelic/blob/v7.1.3/lib/shimmer.js#L456-L459) for this module in the instrumentation bootstrapping code.
