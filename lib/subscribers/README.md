# Subscriber-based Instrumentation

As of v13.2.0, we have begun to refactor our traditional instrumentation (`Shim`-based monkey-patching) to instead subscribe to events emitted by Node's [`diagnostic_channel TracingChannel`](https://nodejs.org/api/diagnostics_channel.html#class-tracingchannel). This is done through [`@apm-js-collab/tracing-hooks`](https://github.com/apm-js-collab/tracing-hooks), a helper for [`orchestrion-js`](https://github.com/apm-js-collab/orchestrion-js) which injects the relevant tracing channels into the instrumented package. We then define a `Subscriber` that listens to these channels for specific events (`asyncEnd`, `asyncStart`, `start`, `end`, and/or `error`) and record what we need from the event data and context (which is preserved through `AsyncLocalStorage`).

## How to Implement

Like `Shim`-based instrumentation, subscriber-based instrumentation largely relies on the specific way the package you're instrumenting is written. However, all packages will follow the below template/guidelines.

### Disable Shim-based Instrumentation

1. While you are testing your new instrumentation, it's important that you're not also testing the old instrumentation. However, you likely want to keep the old instrumentation around while you're refactoring for reference. The easiest way to do this is to just remove the instrumentation reference in `lib/instrumentations.js`.
2. When you are done refactoring, make sure to delete all files in `lib/instrumentation/<package_name>` (or `lib/instrumentation/<package_name>.js`), the tests in `test/unit/instrumentation/<package_name> `that rely on `Shim`-based wrapping, and the instrumentation reference in `instrumentations.js` if you haven't already.

### Instrumentation Config

Now, it is time to look at the internals of the package you're instrumenting. Again, the `Shim`-based instrumentation you're replacing should be helpful here to get the gist of the package internals.

1. Create a folder within `lib/subscribers` with the name of the package. If the package is not a new instrumentation, use the same name as the one in `test/versioned`. If it is a new instrumentation and the package name is exceptionally long or complicated or is prefixed with  `@`, you may provide a shortened version (e.g. `@modelcontextprotocol/sdk `->`mcp-sdk `). Remember to name the versioned test folder with the same name (`test/versioned/<package_name|shortened_package_name>`).
2. Create a `config.js` within that folder.
3. Add a reference to the new config file in [`lib/subscriber-configs.js`](../subscriber-configs.js):
   1. ```javascript
      ...require('./subscribers/<package_name>/config')
      ```
4. Identify one function to start with and find where this function lives in the package i.e. the relative file path.
5. Once you have found where the function you're instrumenting is, you need to determine how it is defined in [AST](https://astexplorer.net/), so that `orchestrion` can properly wrap it. You can then add the proper instrumentation object to your `config.js`.

#### Config Template

```javascript
// in lib/subscribers/<package_name>/config.js

const config = {
  path: './<package_name>/<subscriber_name>.js',
  instrumentations: [
    {
      /**
       * By convention, we prefix channelNames with `nr_` and include at least the expressionName or methodName.
       * It could also contain the moduleName or className to further differentiate between subscribers.
       */
      channelName: 'nr_functionName',
      /**
       * <version_range> should be the same as the old instrumentation.
       * However, you may need to break apart that range across different configs
       * because code can differ from version to version.
       *
       * <relative_path_to_file> is the relative path from the instrumented package
       * to the file that contains the code that you want to instrument
       */
      module: { name: '<package_name>', versionRange: '<version_range>', filePath: '<relative_path_to_file>' },
      functionQuery: {
        className: 'ClassName',
        methodName: 'methodName',
        // If the function is `async`, specify `Async` here. Callback functions are typically `Sync`.
        kind: 'Sync' | 'Async'
      },
      // OR
      // if not a Class
      functionQuery: {
        moduleName: 'ModuleName',
        expressionName: 'expressionName',
        kind: 'Sync' | 'Async'
      },
      // OR
      // if the module is not defined
      functionQuery: {
        expressionName: 'expressionName',
        kind: 'Sync' | 'Async'
      }
    }
    /**
     * If you need to use the same instrumentation/subscriber for differently structured code
     * (e.g. an older version of the package uses moduleName/expressionName, but now the
     * same function is className/methodName), you'd add another instrumentation object
     * to the array of `instrumentations`.
     */
  ]
}

module.exports = {
  // Note: config(s) must be in an array, even if there's just one
  '<package_name>': [
    config
  ]
}
```

### Creating the Subscribers

Now that you have the config specified for the function that you are instrumenting, you'll then need to create a subscriber for it. All subscribers should at least inherit from the base [`Subscriber`](./base.js) with the exception of subscribers that do not rely on `orchestrion` to create their tracing channels (they inherit from the `node:diagnostics_channel` `Subscriber` in [`dc-base.js`](./dc-base.js)).

#### Datastore Subscribers

For datastore queries, inherit from `DbQuerySubscriber`. For datastore operations, inherit from `DbOperationSubscriber`.

#### Messaging Subscribers

For messaging queues, inherit from `MessageConsumerSubscriber` or `MessageProducerSubscriber.`

#### Propagation Subscriber

Many packages are written in a way that causes `AsyncLocalStorage` to lose context. A common instance of this is multiple nestled callbacks. To solve this, create `PropagationSubscriber`s for inner functions within the one you are instrumenting. You may have to experiment a few times to know which function is losing context; in most cases, you should only need one `PropagationSubscriber` to support another subscriber.
