[![npm status badge](https://nodei.co/npm/newrelic.png?stars=true&downloads=true)](https://nodei.co/npm/newrelic/)

# New Relic for Node.js

This package instruments your application for performance monitoring
with [New Relic](http://newrelic.com).

This is a new product. You should try it in your staging or development
environment first to verify it works for you.

Make sure you have a [New Relic account](http://newrelic.com) before
starting. To see all the features, such as slow transaction traces, you will
need a New Relic Pro subscription (or equivalent).

## Table of contents

* [Getting started](#getting-started)
* [RUM / browser timings](#browser-timings-rum--real-user-monitoring)
* [Transactions and request naming](#transactions-and-request-naming)
* [Configuration](#configuring-the-module)
* [Licensing](#license)
* [Security](#security)
* [Contributions](#contributions)
* [Known issues](#known-issues)

## Getting started

1. [Install node](http://nodejs.org/#download). For now, at least 0.8 is
   required. Some features (e.g. error tracing) depend in whole or in
   part on features in 0.10 and above. Development work on the module is
   being done against the latest released non-development version of Node.
2. Install this module via `npm install newrelic` for the application you
   want to monitor.
3. Copy `newrelic.js` from `node_modules/newrelic` into the root directory of
   your application.
4. Edit `newrelic.js` and replace `license_key`'s value with the license key
   for your account.
5. Add `require('newrelic');` as the first line of the app's main module.

If you wish to keep the configuration for the module separate from your
application, the module will look for newrelic.js in the directory referenced
by the environment variable `NEW_RELIC_HOME` if it's set.

When you start your app, New Relic should start up with it and start reporting
data that will appear within [the New Relic UI](https://rpm.newrelic.com/)
after a few minutes. Because the agent minimizes the amount of bandwidth it
consumes, it only reports data once a minute, so if you require the module in
tests that take less than a minute to run, it won't have time to report data to
New Relic. The module will write its log to a file named `newrelic_agent.log`
in the application directory. If New Relic doesn't send data or crashes your
app, the log can help New Relic determine what went wrong, so be sure to send
it along with any bug reports or support requests.

## Browser timings (RUM / Real User Monitoring)

New Relic's instrumentation can extend beyond your application into the
client's browser.  The `newrelic` module can generate `<script>` headers which,
when inserted into your HTML templates, will capture client-side page load
times.

Headers must be manually injected, but no extra configuration is necessary to
enable browser timings.

### Basics

- Insert the result of `newrelic.getBrowserTimingHeader()`
into your html page.
- The browser timing headers should be placed in the beginning of your `<head>` tag.
  - As an exception to the above, for maximum IE compatability, the results of `getBrowserTimingHeader()`
should be placed *after* any `X-UA-COMPATIBLE HTTP-EQUIV` meta tags.
- Do *not* cache the header, call it once for every request.

### Example

Below is an example using `express` and `jade`; Express is a popular web
application framework, and `jade` is a popular template module.  Although the
specifics are different for other frameworks, the general approach described
below should work in most cases.

The simplest way to insert browser timing headers is to pass the `newrelic`
module into your template, and call `newrelic.getBrowserTimingHeader()` from
within the template.

*app.js:*

```javascript
var newrelic = require('newrelic');
var app = require('express')();

// In Express, this lets you call newrelic from within a template.
app.locals.newrelic = newrelic;

app.get('/user/:id', function (req, res) {
  res.render('user');
});
app.listen(process.env.PORT);
```

*layout.jade:*

```jade
doctype html
html
  head
    != newrelic.getBrowserTimingHeader()
    title= title
    link(rel='stylesheet', href='/stylesheets/style.css')
  body
    block content
```

By defaults calls to `newrelic.getBrowserTimingHeader()` should return valid
headers.  You can disable header generation *without* removing your template
code.  In your `newrelic.js` file, add the following to disable header
generation.

```javascript
exports.config = {
  // ... other config
  browser_monitoring : {
    enable : false
  }
};
```

You can also set the environment variable `NEW_RELIC_BROWSER_MONITOR_ENABLE=false`.

It is safe to leave the header generation code in place even when you're not
using it.  If browser timings are disabled, or there is an error such that
working headers cannot be generated, the `newrelic` module will generate an
innocuous HTML comment.  If the `newrelic` module is disabled entirely no
content will be generated.

## Transactions and request naming

In order to get the most value out of New Relic for Node.js, you may have to do
a little work to help us figure out how your application is structured. New
Relic works on the assumption that it can group requests to your application
into transactions, which are defined by giving one or more request paths a
name. These names are used to visualize where your app is spending its time (in
transaction breakdowns), to identify slow requests, and to group scoped
metrics. For example, this can identify slow database queries by showing which
requests are spending a long time waiting on the database.

If you're using Express or Restify with their default routers and are satisfied
with your application being represented by those frameworks' route matchers, you
may not need to do anything. However, if you want more specific names than are
provided by your framework, you may want to use one or more of the tools
described further on.

The simplest way to tell that you need to read further in this document is if
you feel too many of your requests are being lumped together under the
catch-all name `/*`. All requests that aren't otherwise named by the module
will end up grouped under `/*`.

### Background

If you've been working with Node for a while, you're probably accustomed to
thinking of your application's requests in terms of raw URLs. One of the great
things about Node is that it makes it so easy and simple to work with HTTP, and
that extends to things like parsing URLs and creating your own strategies for
naming and routing requests for services like RESTful APIs. This presents a
challenge for New Relic, because we need to keep the number of names we're
tracking small enough that we can keep the New Relic user experience snappy,
and also so we don't overwhelm you with so much data that it's difficult for
you to see the problem spots in your applications. URLs are not a good fit for
how New Relic sees performance.

Another of Node's great strengths is that it provides a lot of tools that build
on top of the `http` module to simplify writing web services. Unfortunately,
that variety greatly complicates things for us, with our limited resources, and
so we offer a few different tools to help you give us the information we need
to provide you useful metrics about your application:

* we can read the route names from the Express and Restify routers, if you're
  using them (and as said above, for many of you, this may be all you need)
* we offer an API for naming the current request, either with simple names or,
  if you prefer, grouped into controllers with actions
* and we support rules stored in your module's configuration that can mark
  requests to be renamed or ignored based on regular expressions matched
  against the request's raw URLs (also available as API calls)

Requests are mapped to transaction names using a deterministic process:

1. On an incoming request, the module creates a New Relic transaction that
   includes the HTTP request method and other metadata. As a fallback (for use
   in the error tracer), each transaction is named after its raw request URL.
2. When a framework using a supported router is in use, the agent copies the
   framework name, route path and request method onto the transaction as its
   transaction name.
3. Within handlers, you can make calls to the module's API to explicitly set
   the name of the route to whatever you want, or mark the route to be ignored
   (or explicitly not ignored, see the below discussion of rules). As noted
   below, the last API call wins when there is more than one.
4. When the transaction is finished (i.e. the response has been completely
   streamed out to the client), any naming or ignoring rules you have specified
   in your configuration are applied. **NOTE:** Older versions of the module
   only applied these rules if nothing else had named the transaction, which
   made using rules with router-based automatic naming impossible. You must be
   using the latest version of New Relic to combine naming and ignoring rules
   with naming set by the router.
5. Finally, New Relic may have its own rules that it applies to the transaction
   name, either because the request is for something New Relic rolls up by
   default (i.e. static assets like images or CSS files), or because New Relic
   is applying rules to remedy metric grouping issues.
6. If nothing has named the transaction after steps 1-5, the transaction is
   named `/*`, which puts that request in the undifferentiated, default bucket
   for requests. This will typically only happen in situations where your
   application uses either no framework, or a framework with a router that
   isn't currently supported by New Relic.

Let's go through the naming tools one at a time.

### Router introspection

Express is the most popular web framework in use within the Node community, and
a number of important services are also using Restify. Both frameworks map
routes to handlers, and both use a similar pattern to do so: they match one or
more HTTP methods (e.g. `GET` or the ever-popular `OPTIONS` – let's hear it for
CORS) along with a potentially parameterized path (e.g. `/user/:id`) or a
regular expression (e.g.  `/^/user/([-0-9a-f]+)$/`). New Relic will capture
both those pieces of information in the request name. If you have support for
slow transaction traces and have enabled `capture_params`, the transaction
trace will also have the request's parameters and their values attached to it.

The only important thing to know about New Relic's support for Express and
Restify is that if you're dissatisfied with the names it comes up with, you can
use the API calls described below to come up with more descriptive names. Also,
if you use a different web framework or router and would like to see support
for it added, please let us know.

### Request naming with the module API

The API is what's handed back from `require('newrelic')`, so

```javascript
var newrelic = require('newrelic');
```

is all you need. Please note that you still need to ensure that loading the New
Relic module is the first thing your application does, as it needs to bootstrap
itself before the rest of your application loads, but you can safely require
the module from multiple modules in your application – it will only initialize
itself once.

#### newrelic.setTransactionName(name)

Name the current request. You can call this function anywhere within the
context of an HTTP request handler, at any time after handling of the request
has started, but before the request has finished. A good rule of thumb is that
if the request and response objects are in scope, you can set the name.

Explicitly calling `newrelic.setTransactionName()` will override any names set
by Express or Restify routes. Calls to `newrelic.setTransactionName()` and
`newrelic.setControllerName()` will overwrite each other. The last call made
before the request ends wins.

**VERY IMPORTANT NOTE:** Do not include highly variable information like GUIDs,
numerical IDs, or timestamps in the request names you create. If your request
is slow enough to generate a transaction trace, that trace will contain the
original URL. If you enable parameter capture, the parameters will also be
attached to the trace. The request names are used to group requests for New
Relic's many charts and tables, and those visualizations' value drops as the
number of different request names increases. If you have 50 or so different
transaction names, you're probably pushing it. If you have more than a couple
hundred, you need to rethink your naming strategy.

#### newrelic.setControllerName(name, [action])

Name the current request using a controller-style pattern, optionally including
the current controller action. If the action is omitted, New Relic will include
the HTTP method (e.g. `GET`, `POST`) as the action. The rules for when you can
call `newrelic.setControllerName()` are the same as they are for
`newrelic.setTransactionName()`.

Explicitly calling `newrelic.setControllerName()` will override any names set
by Express or Restify routes. Calls to `newrelic.setTransactionName()` and
`newrelic.setControllerName()` will overwrite each other. The last one to run
before the request ends wins.

See the above note on `newrelic.setTransactionName()`, which also applies to
this function.

### Rules for naming and ignoring requests

If you don't feel like putting calls to the New Relic module directly into your
application code, you can use pattern-based rules to name requests. There are
two sets of rules: one for renaming requests, and one to mark requests to be
ignored by New Relic.

If you're using socket.io, you will have a use case for ignoring rules right
out of the box. You'll probably want to add a rule like the following:

```javascript
// newrelic.js
exports.config = {
  // other configuration
  rules : {
    ignore : [
      '^/socket.io/.*/xhr-polling'
    ]
  }
};
```

This will keep socket.io long-polling from dominating your response-time
metrics and blowing out the apdex metrics for your application.

#### rules.name

A list of rules of the format `{pattern : "pattern", name : "name"}` for
matching incoming request URLs to `pattern` and naming the matching New Relic
transactions `name`. When automatically naming rules from the router
configuration, the patterns are still applied to the URL path, and not the name
returned by the router. The pattern can be set as either a string or a
JavaScript regular expression literal. Both pattern and name are required.
Additional attributes are ignored.

Can also be set via the environment variable `NEW_RELIC_NAMING_RULES`, with
multiple rules passed in as a list of comma-delimited JSON object literals:
`NEW_RELIC_NAMING_RULES='{"pattern":"^t","name":"u"},{"pattern":"^u","name":"t"}'`

#### rules.ignore

A list of patterns for matching incoming request URLs to be ignored. When using
ignoring rules with instrumented routers, the matches are still made against
the URL paths, not the name returned by the router. Patterns may be strings or
regular expressions.

Can also be set via the environment variable `NEW_RELIC_IGNORING_RULES`, with
multiple rules passed in as a list of comma-delimited patterns:
`NEW_RELIC_IGNORING_RULES='^/socket\.io/\*/xhr-polling,ignore_me'` Note that
currently there is no way to escape commas in patterns.

### API for adding naming and ignoring rules

#### newrelic.addNamingRule(pattern, name)

Programmatic version of `rules.name` above. Naming rules can not be removed
until the Node process is restarted. They can also be added via the module's
configuration. Both parameters are mandatory.

#### newrelic.addIgnoringRule(pattern)

Programmatic version of `rules.ignore` above. Ignoring rules can not be removed
until the Node process is restarted. They can also be added via the module's
configuration. The pattern is mandatory.

### Other API calls

#### newrelic.addCustomParameter(name, value)

Set a custom parameter value to be displayed along with the transaction trace
in the New Relic UI. This must be called within the context of a transaction,
so it has a place to set the custom parameters. Only displayed in the
transaction trace detail view.

#### newrelic.setIgnoreTransaction(ignored)

Tell the module explicitly whether or not a given request should be ignored.
Allows you to explicitly filter out long-polling routes or requests you know
are going to be time-consuming in an uninteresting way, and also allows you
to gather metrics for requests that would otherwise be ignored. Note that
to prevent a transaction from being ignored with this function, you **must**
pass `false` as the parameter – in this case `null` or `undefined` will be
ignored.

#### newrelic.noticeError(error, customParameters)

If your app is doing its own error handling with domains or try/catch clauses,
but you want all of the information about how many errors are coming out of the
app to be centrally managed, use this call. Unlike most of the calls here, this
function can be used outside of route handlers, but will have additional
context if called from within transaction scope. If custom parameters are
passed in on an object literal, they will be passed back to New Relic for
display.

### The fine print

This is the Node-specific version of New Relic's transaction naming API
documentation. The naming API exists to help us deal with the very real problem
that trying to handle too many metrics will make New Relic slow for everybody,
not just the account with too many metrics. If, in conversation with New Relic
Support, you see discussion of "metric explosion", this is what they're talking
about.

While we have a variety of strategies for dealing with these issues, the most
severe is simply to blacklist offending applications. The main reason for you
to be careful in using our request-naming tools is to prevent that from
happening to your applications. We will do everything in our power to ensure
that you have a good experience with New Relic even if your application is
causing us trouble, but sometimes this will require manual intervention on the
part of our team, and this can take a little while.

## Configuring the module

The module can be tailored to your app's requirements, both from the server and
via the newrelic.js configuration file you created. For complete details on
what can be configured, refer to
[`lib/config.default.js`](https://github.com/newrelic/node-newrelic/blob/master/lib/config.default.js),
which documents the available variables and their default values.

In addition, for those of you running in PaaS environments like Heroku or
Microsoft Azure, all of the configuration variables in `newrelic.js` have
counterparts that can be set via environment variables. You can mix and match
variables in the configuration file and environment variables freely;
environment variables take precedence.

Here's the list of the most important variables and their values:

* `NEW_RELIC_LICENSE_KEY`: Your New Relic license key. This is a required
  setting with no default value.
* `NEW_RELIC_APP_NAME`: The name of this application, for reporting to New
  Relic's servers. This value can be also be a comma-delimited list of names.
  This is a required setting with no default value. (NOTE: as a convenience to
  Azure users, the module will use `APP_POOL_ID` as the application name if
  it's set, so you can use the name you chose for your Azure Web Server without
  setting it twice.)
* `NEW_RELIC_NO_CONFIG_FILE`: Inhibit loading of the configuration file
  altogether. Use with care. This presumes that all important configuration
  will be available via environment variables, and some log messages assume
  that a config file exists.
* `NEW_RELIC_HOME`: path to the directory in which you've placed newrelic.js.
* `NEW_RELIC_USE_SSL`: Use SSL for communication with New Relic's servers.
  Enabled by default.
* `NEW_RELIC_LOG`: Complete path to the New Relic agent log, including the
  filename. The agent will shut down the process if it can't create this file,
  and it creates the log file with the same umask of the process. Setting this
  to `stdout` will write all logging to stdout, and `stderr` will write all
  logging to stderr.
* `NEW_RELIC_LOG_LEVEL`: Logging priority for the New Relic agent. Can be one
  of `error`, `warn`, `info`, `debug`, or `trace`. `debug` and `trace` are
  pretty chatty; unless you're helping New Relic figure out irregularities with
  the module, you're probably best off using `info` or higher.

For completeness, here's the rest of the list:

* `NEW_RELIC_ENABLED`: Whether or not the agent should run. Good for
  temporarily disabling the agent while debugging other issues with your code.
  It doesn't prevent the module from bootstrapping its instrumentation or
  setting up all its pieces, it just prevents it from starting up or connecting
  to New Relic's servers. Defaults to true.
* `NEW_RELIC_ERROR_COLLECTOR_ENABLED`: Whether or not to trace errors within
  your application. Values are `true` or `false`. Defaults to true.
* `NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERROR_CODES`: Comma-delimited list of HTTP
  status codes to ignore. Maybe you don't care if payment is required? Ignoring
  a status code means that the transaction is not renamed to match the code,
  and the request is not treated as an error by the error collector. Defaults
  to ignoring 404.
* `NEW_RELIC_IGNORE_SERVER_CONFIGURATION`: Whether to ignore server-side
  configuration for this application. Defaults to false.
* `NEW_RELIC_TRACER_ENABLED`: Whether to collect and submit slow transaction
  traces to New Relic. Values are `true` or `false`. Defaults to true.
* `NEW_RELIC_TRACER_THRESHOLD`: Duration (in seconds) at which a transaction
  trace will count as slow and be sent to New Relic. Can also be set to
  `apdex_f`, at which point it will set the trace threshold to 4 times the
  current ApdexT.
* `NEW_RELIC_APDEX`: Set the initial Apdex tolerating / threshold value in
  seconds.  This is more often than not set from the server. Defaults to 0.100.
* `NEW_RELIC_CAPTURE_PARAMS`: Whether to capture request parameters on slow
  transaction or error traces. Defaults to false.
* `NEW_RELIC_IGNORED_PARAMS`: Some parameters may contain sensitive values you
  don't want being sent out of your application. This setting is a
  comma-delimited list of names of parameters to ignore. Defaults to empty.
* `NEW_RELIC_NAMING_RULES`: A list of comma-delimited JSON object literals:
  `NEW_RELIC_NAMING_RULES='{"pattern":"^t","name":"u"},{"pattern":"^u","name":"t"}'`
  See the section on request and transaction naming for details. Defaults to
  empty.
* `NEW_RELIC_IGNORING_RULES`: A list of comma-delimited patterns:
  `NEW_RELIC_IGNORING_RULES='^/socket\.io/.*/xhr-polling,ignore_me'` Note that
  currently there is no way to escape commas in patterns. Defaults to empty.
* `NEW_RELIC_TRACER_TOP_N`: Increase this number to increase the diversity of
  slow transaction traces sent to New Relic. Defaults to 1. See the description
  in `lib/config.default.js`, as this feature is exceedingly hard to summarize.
* `NEW_RELIC_HOST`: Hostname for the New Relic collector proxy. You shouldn't
  need to change this.
* `NEW_RELIC_PORT`: Port number on which the New Relic collector proxy will be
  listening. You shouldn't need to change this either.
* `NEW_RELIC_DEBUG_METRICS`: Whether to collect internal supportability metrics
  for the agent. Don't mess with this unless New Relic asks you to.
* `NEW_RELIC_DEBUG_TRACER`: Whether to dump traces of the transaction tracer's
  internal operation. It's unlikely to be informative unless you're a New Relic
  Node.js engineer and it has a significant performance cost, so use with care.
* `NEW_RELIC_BROWSER_MONITOR_ENABLE`: Whether to generate browser timing (RUM) headers or not.

## Security

We take security (and the protection of your and your users' privacy) very
seriously. See SECURITY.md for details, but the brief version is that if you
feel you've found a security issue in New Relic for Node, contact us at
security@newrelic.com.

## Contributions

We owe a debt to all of the beta testers and users who have provided us with
feedback, and in some cases significant pieces of code. (If you wish to
contribute, please see CONTRIBUTING.md in this directory.) In particular, we're
indebted to these people:

* Hernan Silberman, for his work on the memcached instrumentation.
* Jeff Howell &lt;jhowell@kabam.com&gt;, for coming up with a much simpler way
  to instrument node-mongodb-native, as well as pointing out a problem with the
  Connect instrumentation.

## Recent changes

Information about changes to the module are in NEWS.md.

### Known issues:

* New Relic for Node is only supported on Node.js 0.8 and newer. Some features
  may behave differently between 0.8, 0.10 and 0.11 / 0.12. The agent is
  optimized for newer versions of Node.
* There are irregularities around transaction trace capture and display.  If
  you notice missing or incorrect information from transaction traces, let us
  know.
* There are <del>over 20,000</del> <del>30,000</del> <del>40,000</del> <ins>*A
  LOT* of</ins> modules on npm. We can only instrument a tiny number of them.
  Even for the modules we support, there are a very large number of ways to use
  them. If you see data you don't expect on New Relic and have the time to
  produce a reduced version of the code that is producing the strange data, it
  will be used to improve the module and you will have the Node team's
  gratitude.
* The CPU and memory overhead incurred by New Relic for Node is relatively
  minor (~1-10%, depending on how much of the instrumentation your apps end up
  using).  GC activity is significantly increased while the agent is active,
  due to the large number of ephemeral objects created by metrics gathering.
* When using Node's included clustering support, each worker process will open
  its own connection to New Relic's servers, and will incur its own overhead
  costs.

### New Relic features available for other platforms not yet in Node.js

* cross-application tracing (depends on RUM)
* custom metrics and instrumentation
* slow SQL traces and explain plans
* garbage collector instrumentation
* thread profiling
* X-ray transactions (depends on thread profiling)
* capacity planning

## LICENSE

New Relic for Node is free-to-use, proprietary software. Please see the full
license (found in LICENSE in this distribution) for details on its license and
the licenses of its dependencies.
