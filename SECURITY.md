# Security Policy

## Supported versions

Only the latest released version of each plugin in this marketplace receives security fixes. Update with `/plugin marketplace update axis-hub` before reporting, to check that the issue still exists.

| Plugin | Supported version |
|--------|-------------------|
| foreman | latest (see the [plugin list](README.md#plugins)) |

## Reporting a vulnerability

Please do **not** open a public issue for security problems.

1. **Preferred:** use GitHub private vulnerability reporting - go to the [Security tab](https://github.com/Black-Axis/axis-hub/security) of the repository and choose **Report a vulnerability**.
2. **Fallback:** email **black_axis@outlook.com** with the subject starting with `[SECURITY]`.

Include:
- The affected plugin and version.
- What the problem is and its impact.
- Steps to reproduce (a minimal project or input if possible).
- Your Claude Code version and operating system.

## What to expect

- We acknowledge your report within **7 days**.
- We investigate, keep you informed, and credit you in the fix release notes unless you prefer to stay anonymous.
- Please keep the details private until a fix is released.

## Scope

Plugins here are instructions that Claude Code follows, plus hook scripts that run on your machine. Examples of issues we treat as security vulnerabilities:

- A command, agent, or skill that makes Claude edit files, run commands, or perform actions without the permission prompts the user's permission mode requires (for example, overly broad `allowed-tools`).
- A hook script that can be abused to run unintended commands, read or leak data, or block Claude Code.
- Instructions that make Claude send project content, secrets, or personal data to an external service.
- Content in user-provided files (working files, imported plans, task files) that can hijack plugin instructions into harmful actions.
- Secrets or credentials committed to this repository.

Out of scope: vulnerabilities in Claude Code itself (report those to Anthropic), and issues that need the user to disable their own permission prompts.
