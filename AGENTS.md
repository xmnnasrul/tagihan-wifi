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

## Git attribution

- Use the configured human Git identity as author and committer. Never set `user.name`, `user.email`, `--author`, or the committer to GitHub Copilot, and never add a Copilot `Co-authored-by` trailer.
- If the Git identity is missing or identifies Copilot, stop before committing or pushing and ask the user to configure their identity. Do not invent one.
- Before every push, inspect all outgoing commits against the upstream with `git log --format='%h %an <%ae>%n%B' @{upstream}..HEAD`. Push only if none attributes a commit to Copilot as author or co-author. If there is no upstream, inspect the range against the exact target branch.
