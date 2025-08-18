# Subscribers

A subscriber is composed of two parts:

1. A descriptor to supply to [orchestrion-js](https://github.com/apm-js-collab/orchestrion-js)
that indicates which module to intercept, the file(s) to patch, and the
location(s) to patch.
2. An object that utilizes [diagnostics channel](https://nodejs.org/api/diagnostics_channel.html)
to listen for the events dispatched by the result of applying the patch(es)
described in 1.
   
## Example

Assuming we have a module named `foo` at version 1.1.0 whose code looks like:

```js
'use strict'

module.exports = class Foo {
  hello(name) {
    console.log(`hello, ${name ?? "who dis?"}`)
  }
}
```

Let's inject diagnostics to the `hello` method so that we can track when
it is invoked. First, we'll define the configuration descriptor:

```js
// foo/config.js
'use strict'

const fooHelloPatch = {
  // Path to the script that exports the diagnostics channel listener. The path
  // is relative to the `lib/subscribers/` directory.
  path: './foo/listener.js',
  // Each instrumentation object is a configuration block for orchestrion-js.
  instrumentations: [
    {
      channelName: 'nr_foo_hello',
      module: {
        name: 'foo',
        versionRange: '~1.0.0',
        // Path to the file within the module's package that needs to be
        // modified. In this example, the module has a simple `index.js` file.
        filePath: 'index.js'
      },
      // A `functionQuery` describes the AST node for orchestrion to patch.
      // TODO: we really should have a link here to the documention for this
      // DSL. Unfortunately, it doesn't exist yet.
      functionQuery: {
        className: 'Foo',
        methodName: 'hello',
        kind: 'Sync'
      }
    }
  ]
}

module.exports = {
  // `foo` being the name of the module we are instrumenting.
  foo: [
    fooHelloPatch
  ]
}
```

Second, we add our listener code:

```js
// foo/listener.js
'use strict'

const Subscriber = require('../base.js')

module.exports = class FooSubscriber extends Subscriber {
  constructor({ agent, logger }) {
    super({
      agent,
      logger,
      // Same string you'd pass to the `require` function:
      packageName: 'foo',
      // Same string we supplied in the config:
      channelName: 'nr_foo_hello'
    })
  }
  
  handler(data, ctx) {
    // `self`: The object exported by `require('foo')`.
    // `arguments`: The arguments provided to the function/method that we have
    // patched.
    const { self, arguments: args } = data
    console.log(`"${args[0]}" was provided as the name`)
    // TODO: are we supposed to return something special here?
  }
}
```

With these in place, we can update `lib/subscriber-configs.js` to register
our new subscriber.
