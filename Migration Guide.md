
# Migration Guide
This guide is intended to help with upgrading major versions of the Node Agent.
This information can also be found on [our documentation website][upgrade-doc].

## Upgrading to Agent v2

### Breaking Changes

**Reversed naming and ignore rules**: Previously, rules defined in the config
properties `rules.name` and `rules.ignore` were applied in reverse order, the
first rule in the list was applied last. Agent v2 now applies rules in the
order they are defined, so the first rule in the list is applied first.

Users of naming rules in the v1 agent will need to reverse the order of their
rules in the configuration if they're noticing any issues.

**De-duplicated HTTP request transactions**: The v1 agent starts a new
transaction for each _listener_ on an HTTP server's `request` event. In
applications with multiple listeners on the `request` event this would result
in extraneous transactions being created that almost always did not get named
correctly. In v2 the agent only creates a single transaction for each `request`
event emitted.

Any users who utilized multiple `request` event listeners and added a call to
`newrelic.ignoreTransaction()` to remove the extra transactions should remove
those calls.

**Stopped swallowing outbound request errors**: In v1 the Node Agent swallows
unhandled `error` events emitted by outbound HTTP request objects. Agent v2
removed this behavior in favor of not changing normal Node execution, meaning
the `error` event will always be emitted.

If you are making outbound requests and currently do not listen for the `error`
event, add a listener and handle the error as appropriate for your application.

### Deprecated API Methods
These methods have been marked as deprecated in Agent v2 and will be removed in
v3.

* `newrelic.createWebTransaction()`

  Replace with `newrelic.startWebTransaction()` and `newrelic.getTransaction()`.

* `newrelic.createBackgroundTransaction()`

  Replace with `newrelic.startBackgroundTransaction()` and `newrelic.getTransaction()`.

### New API Methods

* [`newrelic.getTransaction()`](https://newrelic.github.io/node-newrelic/docs/API.html#getTransaction)

  This method gets a reference to the currently running transaction. It should
  be used in conjunction with `newrelic.startWebTransaction`,
  `newrelic.startBackgroundTransaction`, or with callback-based message
  consumer services. See our [Trouble Shooting][messaging-troubleshooting-doc]
  documentation for more information on its usage.

* [`newrelic.startWebTransaction()`](https://newrelic.github.io/node-newrelic/docs/API.html#startWebTransaction)
  [`newrelic.startBackgroundTransaction()`](https://newrelic.github.io/node-newrelic/docs/API.html#startBackgroundTransaction)

  These new API methods replace the older `create*Transaction` methods. They
  are easier to use and seamlessly work with promises. Note that unlike the old
  method, the provided callback is invoked immediately.

* [`newrelic.instrument()`](https://newrelic.github.io/node-newrelic/docs/API.html#instrument)
  [`newrelic.instrumentDatastore()`](https://newrelic.github.io/node-newrelic/docs/API.html#instrumentDatastore)
  [`newrelic.instrumentWebframework()`](https://newrelic.github.io/node-newrelic/docs/API.html#instrumentWebframework)
  [`newrelic.instrumentMessages()`](https://newrelic.github.io/node-newrelic/docs/API.html#instrumentMessages)

  These methods can be used to add custom instrumentation for 3rd party modules,
  including those already instrumented by the Node Agent. See our
  [instrumentation tutorials][instrumentation-tutorial] for more information
  on using these methods.

### Node Version Support
The earliest version of Node supported by the v2 agent is 0.10. Node 0.8, which
has not been updated since July of 2014, is not supported by v2. Customers
running Node 0.8 will need to upgrade to a supported version of Node or remain
on the v1 agent. [Node 0.10 is also no longer receiving updates][node-lts-schedule],
but we will continue to support this version of Node for the time being. We
highly recommend moving to a newer version of Node as soon as possible. The
next major version of the New Relic Node Agent will likely remove support for
it.

### npm Version Support
The agent now requires npm version 2.0.0 or higher. This version of npm comes
packaged with Node 0.10.44 or higher. If you are using an earlier version of
Node 0.10 you will need to first install npm 2.0.0 or higher or upgrade to a
newer version of Node. Version 2 of npm can be installed with:

```sh
$ npm install --global npm@2
```

### Released Feature Flags
* `express_segments`: This feature is no longer configurable.
* `cat`: This feature is now controlled by the `cross_application_tracer.enabled`
  configuration value.

### New Framework Minimum Versions

| Module  | Old Minimum | New Minimum |
|---------|-------------|-------------|
| express | 2.0.0 | 4.6.0 |
| mysql   | 0.9.0 | 2.0.0 |


[upgrade-doc]: https://docs.newrelic.com/docs/agents/nodejs-agent/installation-configuration/upgrade-node-agent-versions
[messaging-troubleshooting-doc]: https://docs.newrelic.com/docs/agents/nodejs-agent/troubleshooting/troubleshoot-message-consumers
[instrumentation-tutorial]: https://newrelic.github.io/node-newrelic/docs/tutorial-Instrumentation-Basics.html
[node-lts-schedule]: https://github.com/nodejs/LTS/tree/2b4253#lts-schedule1
