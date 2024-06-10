# AI Support Spec

This document describes the structure of the [ai-support.json](./ai-support.json)
file. The JSON file is utilized by an automation to update our documentation
with the AI libraries/abstractions/gateways that we support.

## Structure

The general structure of the JSON file is that of an object who's keys
map to a descriptor for a supported AI thing. Each descriptor has a `kind`
property that indicates what sort of AI thing is being described.

### kind = "abstraction"

An abstraction is a module that provides a single common interface to many
LLMs or gateways. An abstraction descriptor has the following fields:

+ `title` (string): A human readable name for the abstraction.
+ `featuresPreamble` (string): An optional block of text that should be added
to the document prior to the features table.
+ `providersPreamble` (string): An optional block of text that should be added
to the document prior to the providers table.  
+ `features` (object[]): An array of feature entities.
+ `providers` (object[]): An array of provider entities.

### kind = "gateway"

A gateway is a service that provides access to multiple large language models
(LLMs) through a single API. A gateway descriptor has the following fields:

+ `title` (string): A human readable name for the gateway.
+ `preamble` (string): An optional block of text that should be added to the
document prior to the models table.
+ `footnote` (string): An optional block of text that should be added to the
document subsequent to the models table.
+ `models` (object[]): An array of model entities.

### kind = "sdk"

A SDK is a module that provides an API that is specific to a single LLM. An SDK
descriptor has the following fields:

+ `title` (string): A human readable name for the SDK.
+ `featuresPreamble` (string): An optional block of text that should be added
to the document prior to the features table.
+ `features` (object[]): An array of feature entities.

## Entities

### Feature

Describes an LLM feature. It is an object with the following fields:

+ `title` (string): A human readable name for the feature.
+ `supported` (boolean): Indicates if our instrumentation supports the feature
or not.

### Model

Describes an LLM, the features it supports, and the features we instrument. It
is an object with the following fields:

+ `name` (string): A human readable name for the LLM.
+ `features` (object[]): An array of feature entities. 

### Provider

Describes an LLM or gateway that is supported by an abstraction. It is an object
with the following fields:

+ `name` (string): A human readable name for the LLM or gateway.
+ `supported` (boolean): Indicates if we instrument this provider within the
context of the abstraction.
+ `transitively` (boolean): Indicates if we instrument this provider directly
in the instrumentation for the abstraction (`false`), or if we rely on a
transitive instrumentation (`true`).
