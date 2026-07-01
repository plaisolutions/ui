# PLai Chat SDK

Monorepo for the Plai chat SDK:

- `@plaisolutions/client`: framework-agnostic SSE chat client.
- `@plaisolutions/react`: React hook adapter built on top of `@plaisolutions/client`.

## Development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

## Manual Publish

If you want to publish manually from your terminal, use a **granular npm access token** with:

- Publish permission (`read/write`) for:
  - `@plaisolutions/client`
  - `@plaisolutions/react`
- **Bypass 2FA for publish** enabled

Configure the token locally (never commit it):

```bash
npm config set //registry.npmjs.org/:_authToken=<NPM_GRANULAR_TOKEN>
npm whoami
```

Publish in this order:

```bash
pnpm --filter @plaisolutions/client publish --access public
pnpm --filter @plaisolutions/react publish --access public
```

Verify:

```bash
npm view @plaisolutions/client version
npm view @plaisolutions/react version
```

## Release Automation

This repo is configured with:

- `.github/workflows/ci.yml`: lint, typecheck, test, build on PRs/push to `main`.
- `.github/workflows/release.yml`: Changesets release flow on push to `main`.

### How the release workflow works

1. PRs add changesets with `pnpm changeset`.
2. On `main`, the workflow uses `changesets/action` to:
  - open/update a release PR with version bumps, or
  - publish packages when a release PR is merged.



### Required npm setup (Trusted Publishing)

Before automatic publish can work, configure npm Trusted Publishing for this GitHub repository and both packages:

- `@plaisolutions/client`
- `@plaisolutions/react`

In npm package settings, add this repository as a trusted publisher for GitHub Actions (OIDC).

## Troubleshooting

If you see this error when running `pnpm` commands:

```txt
TypeError [ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING]
```

you are likely using an old global `corepack` shim (commonly from `/usr/local/...`) that is incompatible with Node 22 + modern pnpm.

Use these steps:

```bash
which corepack
corepack --version

# Remove old global corepack if present (may require sudo depending on your install)
npm uninstall -g corepack || true

# Refresh shell command cache
hash -r

# Re-enable bundled corepack and activate the project pnpm version
corepack enable
corepack prepare pnpm@11.5.3 --activate

# Verify
which pnpm
pnpm -v
```

Fallback (if you prefer not to use corepack shims):

```bash
npm install -g pnpm@11.5.3
pnpm -v
```
