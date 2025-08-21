## Running Benchmarks

The easiest way to run all benchmarks is by using the npm script:

```zsh
npm run bench
```

If you need to run a single benchmark suite, for example the sql parser
benchmarks, it is easiest to run and view the output by:

```zsh
./bin/run-bench.js lib/db/query-parsers/sql.bench.js && \
  cat benchmark_results/$(ls -1rt benchmark_results | tail -n 1)
```

Notice that we do not specify the leading "test/benchmark/" when providing
the benchmark file we want to run.

You may also specify the output file name with `--filename`.

```zsh
node ./bin/run-bench.js --filename=your-desired-filename
```

### Metrics

Our benchmark tests now send metrics to New Relic through the OTLP metrics endpoint.

You must provide a `NEW_RELIC_LICENSE_KEY` (specifically a production user license key) in order for the benchmark metrics to be sent. One way to do this is with a `.env`:

```zsh
cd bin
touch .env
# NEW_RELIC_LICENSE_KEY=YOUR_PROD_LICENSE_KEY
node --env-file .env ./run-bench.js
```

The metrics are displayed in [Node Agent Benchmark Test Metrics](https://staging.onenr.io/0ERPpA6ZPRW).
