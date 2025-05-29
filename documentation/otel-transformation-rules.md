# OpenTelemetry Transformation Rules JSON Schema Documentation

This document describes the JSON schema for OpenTelemetry Transformation Rules, which define transaction events, trace segments, and time slice metrics are synthesized from span data. The intention is the attributes are processed when a span ends to ensure all the attributes are available for processing.  The segment naming occurs when a span starts for all segments except for the transaction segment which is processed when the span ends.  The schema is designed to be strict, ensuring that all rules conform to a defined structure and that no unknown properties are allowed.

**Note**: This schema has only been tested with the Node.js agent, and while it is expected to work with other language agents, the implementation details may vary.

---

## Top-Level Structure

- **Type:** Array  
  The root of the document is an array of rule objects.

---

## Rule Object

Each item in the array is a rule object with the following properties:

### Required Properties

- **name** (`string`):  
  The unique name of the transformation rule.

- **type** (`string`):  
  The type of the rule: `producer`, `consumer`, `external`, `server`, `db`, and `internal`.

- **matcher** (`object`):  
  Defines the criteria for matching spans to this rule.

---

### matcher

- **required_span_kinds** (`string[]`):  
  List of span kinds (e.g., `client`, `server`, `producer`) required for this rule to match.

- **required_attribute_keys** (`string[]`):  
  List of attribute keys that must be present on the span.

- **attribute_conditions** (`object`, optional):  
  An object where each key is an attribute name and the value is an array of allowed values for that attribute.

---

### attributes

- **attributes** (`array`, optional):  
  An array of attribute mapping objects, each describing how to extract or compute an attribute for the segment, transaction, or trace.

#### Attribute Mapping Object

- **key** (`string`, optional):  
  The key of the span attribute to extract.

- **value** (`string|number|boolean`, optional):  
  A literal value to use for the attribute.

- **template** (`string`, optional):  
  A template string for constructing the attribute value.

- **regex** (`object`, optional):  
  Describes how to extract values using regular expressions.  
  - **statement** (`string`, required): The regex pattern.
  - **flags** (`string`, optional): Regex flags.
  - **groups** (`array`, optional): Array of group extraction objects, each with:
    - **group** (`integer|string`): The group index or name.
    - **key** (`string`, optional): The span attribute key(used to remove from trace segment) 
    - **name** (`string`, optional): The attribute name for the extracted value.
    - **regex** (`object`, optional): Nested regex extraction.
      - **statement** (`string`, required): The regex pattern.
      - **flags** (`string`, optional): Regex flags.
      - **value** (`integer|string`, optional): Value to extract.
      - **prefix** (`string`, optional): Prefix to add to the extracted value.

- **target** (`string`, optional):  
  Where to assign the attribute (`segment`, `transaction`, or `trace`).

- **name** (`string`, optional):  
  The name to use for the attribute in the target.

- **highSecurity** (`boolean`, optional):  
  If true, the attribute is omitted in high-security mode.

- **mappings** (`array`, optional):  
  Array of mapping objects for advanced transformations. Used to apply custom functions to the attribute value.(e.g. only include an attribute if it matches a certain condition)
  - **key** (`string`): Mapping key.
  - **arguments** (`string`): Mapping function arguments(comma delimited).
  - **body** (`string`): Mapping function body.

---

### transaction

- **transaction** (`object`, optional):  
  Describes how to construct the transaction event.
  - **type** (`string`, required): Transaction type. values: `web`, or `message`
  - **system** (`string`, optional): messaging system span attribute.(consumer segments only)
  - **name** (`object`, optional): Transaction naming details.
    - **verb** (`string`, optional): span attribute to use as verb.(sever segments only)
    - **path** (`string`, optional): span attribute to use as route(server segments only)
    - **prefix** (`string`, optional): Prefix for the transaction name.(rpc server segments only)
    - **templatePath** (`string`, optional): template for the partial transaction name.
    - **templateValue** (`string`, optional): template for the transaction path.
    - **value** (`string`, optional): Literal value for the transaction name.
  - **url** (`object`, optional): URL construction details.(server segments only)
    - **template** (`string`, optional): template to construct the URL.
    - **key** (`string`, optional): span attriute to use as URL.
    - **mappings** (`array`, optional): Array of mapping for advanced URL transformations.
      - **key** (`string`): Mapping key.
      - **arguments** (`string`): Mapping function arguments(comma delimited).
      - **body** (`string`): Mapping function body.

---

### segment

- **segment** (`object`, optional):  
  Describes how to construct the trace segment. 
  - **name** (`object`, optional): Segment naming details.
    - **template** (`string`, optional)
  - **host** (`string|object`, optional): span attribute to use as host.(external segments only)
    - **template** (`string`, optional): template for the host.
    - **key** (`string`, optional): span attribute to use as host.
  - **system** (`string`, optional): span attribute to use as system.(producer and rpc external segments only)
  - **url** (`string`, optional): span attribute to use as URL(external segments only)
  - **operation** (`string`, optional): span attribute to use as operation.(db segments only)
  - **type** (`string`, optional): span attribute to use as type.(db segments only)
  - **statement** (`string`, optional): span attribute to use as sql query(db segments only)  
  - **collection** (`string`, optional): span attribute to use as collection name(db segments only)

---

## Additional Notes

- **Strictness:**  
  The schema does not allow unknown properties at any level (`additionalProperties: false`).

- **Extensibility:**  
  If you add new fields or structures, update the schema accordingly.

- **Validation:**  
  Use this schema with a JSON Schema validator to ensure your transformation rules are well-formed and consistent.

---

**Example Rule:**
```json
{
  "name": "Producer_1_30",
  "type": "producer",
  "matcher": {
    "required_span_kinds": ["producer"],
    "required_attribute_keys": ["messaging.system", "messaging.destination.name"]
  },
  "attributes": [
    {
      "key": "server.address",
      "target": "segment",
      "name": "host"
    }
  ],
  "segment": {
    "name": {
      "template": "MessageBroker/${messaging.system}/${messaging.operation.name}/Produce/Named/${messaging.destination.name}"
    }
  }
}
```

---
