The `.proto` files in this directory are provided by New Relic internal
specifications.

The `.json` files in this directory are JSON descriptor files derived from
the equivalent `.proto` files. This is accomplished by utilizing the CLI
tool provided by `protobufjs`. As an example:

```sh
npx --package=protobufjs-cli -c 'pbjs --keep-case v1.proto' > v1.json
```
