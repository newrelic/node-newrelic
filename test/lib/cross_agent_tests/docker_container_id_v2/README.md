These tests cover parsing of Docker container IDs on Linux hosts out of
`/proc/self/mountinfo` (or `/proc/<pid>/mountinfo` more generally).

The `cases.json` file lists each filename in this directory containing
example `/proc/self/mountinfo` content, and the expected Docker container ID that
should be parsed from that file.
