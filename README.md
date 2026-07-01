# plai-ui

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

