# Project agent instructions

## Working principles

- Make the smallest change that fully meets the need.
- If the request or project direction is unclear, ask before changing code. Do not guess important decisions.
- Keep replies brief, clear, and easy to understand.

## Before changing code

- Read the relevant code and context.
- Check related callers, tests, configuration, and user impact.
- Do not add unrelated changes.

## Implementation and validation

- Follow existing patterns and use existing helpers; avoid unnecessary complexity.
- Update all affected areas and preserve security, validation, and accessibility.
- After changing code, run relevant tests, type checks, or lint to catch errors. Fix failures caused by the change.
- If validation cannot run or fails for an unrelated reason, say so clearly; never claim it passed.
- Add focused tests for non-trivial new logic.

## Terminal use

- Reuse an existing terminal when the available tools support it.
- Check whether a server or long-running process is already running before starting a duplicate.
- Do not stop a process you did not start.
