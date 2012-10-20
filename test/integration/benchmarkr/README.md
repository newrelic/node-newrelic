# Benchmarkr

The best part about this idea is that it came to me while I was half asleep. I just worked through the details while I was drowsing and then all I had to do was capture it once I woke up.

## Why it exists

I want an app that does something useful, but which exercises as much of the Node.js agent's instrumentation as makes sense.

## What it does

`jsperf` does an excellent job of benchmarking multiple snippets against each other, but it's not as good at benchmarking multiple versions of the same code against each other. Also, its emphasis is on browser code and simple snippets of context-free pure JavaScript, although it does offer plugin support for browser tools like jQuery.

I want a tool that allows me to test multiple versions of snippets, functions, modules, and packages against each other. Each one gets multiple runs, with warmup, in one or more versions of node, and the performance data is stored and aggregated with a view towards statistical postprocessing.

## Architecture

For the example app, write a server to create and run benchmarks and then store the data:

- **Restify** for the basic framework.
- **MongoDB** for the complete results.
- **Redis** for queueing and scheduling for the tests.
- **Memcached** for intermediate results.
- **MySQL** for aggregate data.

### Server components

- *external services:* Each external service is controlled via a child process object. Start all the servers in parallel. Each service in its own module, which registers a shutdown method as well as a startup method.
- *bootstrappers:* Write the bootstrappers as middleware.
- *DALs:* Each service should have its own API in its own module.
- *job control:* (run the snippets)
- *public API:* Route handlers in individual files.

### API details

- snippets are versioned
- a "snippet" is a runnable unit of code characterized by one or more fragments or files with a single named point of entry, which is a simple JavaScript function call
- all Benchmarkr metadata must be out-of-band, so a snippet is always at least two fragments -- the code itself, and a CommonJS package descriptor (stored in the canonical `package.json` file) that has a name, one or more keywords, a version, and a main file / function.
- keywords are used to correlate results
- use semantic versioning
- the default filename is `index.js`
- the default function name is `run`
- for asynchronous code, every main function must take a `done` / `next` parameter which gets called to denote completion
- the snippets do not do any benchmarking themselves
- no test functions that throw feed into the results

complete minimal main.js:
```javascript
function run(next) { next(); }
```

complete minimal package.json:
```json
{
  "name": "trivial",
  "keywords": "nop",
  "version": "0.0.0"
}
```

## Design notes

- Inject dependencies.
- The inner event loop only gets called once all of the external connections are set up, and the function that runs that loop gets passed its dependencies, AMD-style.
- Sessions are not required to drive the API -- use a hypermedia style.
- Make the design like jsperf’s.
- Don’t get fancy with the asset pipeline.
- The middleware system is as much about learning to write flow control libraries as anything.

## Tasks.todo
- Investigate architect for the middleware. @done