## Running Benchmarks

The easiest way to run all benchmarks is by using the npm script:

```sh
> npm run bench
```

If you need to run a single benchmark suite, for example the sql parser
benchmarks, it is easiest to run and view the output by:

```sh
> ./bin/run-bench.js lib/db/query-parsers/sql.bench.js && \
  cat benchmark_results/$(ls -1rt benchmark_results | tail -n 1)
```

Notice that we do not specify the leading "test/benchmark/" when providing
the benchmark file we want to run.
