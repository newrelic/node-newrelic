# event_source_info

This test fixture is intended to verify that the the agent correctly detects event
types (in languages where type is dynamic) and correctly harvests ARN values. The
fixtures are structured as follows:

    {
      "<type_key>": {
        "expected_type": "alb",
        "expected_arn": "arn:aws:elasticloadbalancing:us-east-2:123456789012:targetgroup/lambda-279XGJDqGZ5rsrHC2Fjr/49e9d65c45c6791a",
        "event": {...}
      }
    }

Each fixture is a JSON object with three keys: `expected_type`, `expected_arn`, and `event`.
`event` is an example AWS Lambda invocation event. The other two are values that the agent
should extract from that event, and ought to write test assertions against.

The top-level `<type-key>` is provided only for convenience.
