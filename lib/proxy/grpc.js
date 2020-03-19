'use strict'
class ProxyGrpc {
  constructor() {
    // change value of grpcLibrary to the name of the
    // module you want -- `grpc`, `@grpc/grpc`, etc.
    // TODO/APPOLOGIES: maybe pull this from config -- although then
    //                  that's a vector for attack.
    const grpcLibrary = '@grpc/grpc-js'
    this.library = require(grpcLibrary)

    // add methods or objets from base grpc class that we need
    // TODO/APPOLOGIES: would it be better to define actual
    //                  functions/methods that call though to
    //                  to the real library?
    this.credentials = require(grpcLibrary).credentials
    this.Metadata = require(grpcLibrary).Metadata
    this.loadPackageDefinition = require(grpcLibrary).loadPackageDefinition
  }
}
module.exports = (new ProxyGrpc)
