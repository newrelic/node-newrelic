Houses core instrumentation. It differs from third-party because we are still monkey patching code but emitting it over tracing channel.  

Registering a core subscriber entails both instrumenting via the `instrument` method and providing the necessary parameters to the extended subscriber class for subscribing and creating the necessary telemetry.

This is an example for a core subscriber. That wraps the methods `bar` and `baz` on `core-lib-name`. Most core libraries simply create segments with a naming conventions of `<pkg-name>.<method>`. The `end`, `asyncEnd` events simply just touch the active segment.

Set `internal = true` when the instrumented methods delegate to one another (as `child_process.exec` calls `execFile`). Without it, one logical operation creates a segment per method, and because the async context then points at the inner segment, the outer one's timer is never stopped when the operation completes.

```js

const BaseCoreSubscriber = require('../base')
// eslint-disable-next-line n/no-unsupported-features/node-builtins
const { tracingChannel } = require('node:diagnostics_channel')
const shimmer = require('#agentlib/shimmer.js')
const instrumentedMethods = ['bar', 'baz']

class FakeCoreSubscriber extends BaseCoreSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'core-lib-name', instrumentedMethods })
  }

  instrument(coreLibName) {
    const self = this
    shimmer.wrapMethod(coreLibName, this.packageName, function wrapMethod(original, method) {
      const channel = tracingChannel(`${self.id}:${method}`)
      return function wrappedMethod(...args) {
        const data = { name: `${self.packageName}.${method}` }
        return channel.traceCallback(original, -1, data, this, ...args)
      }
    })
  }
}

module.exports = FakeCoreSubscriber
```

Add the module's name to `CORE_PACKAGES` in `config.js` so the subscriber is
picked up. It resolves to `./core/<name>`, so a simple module lives at
`core/<name>.js` and one that grows extra files can become `core/<name>/index.js`
without a config change. A module needing more than one subscriber should get its
own entry in `lib/subscriber-configs.js` instead.

More to come as we migrate more libraries.
