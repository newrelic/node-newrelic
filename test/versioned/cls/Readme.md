As of 2024-10-30, the consensus on the team is that this test exists to ensure
we are not breaking applications that utilize the `continuation-local-storage`
module. We do not instrument that module, but we shouldn't be breaking it,
either.
