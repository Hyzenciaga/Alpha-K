# Personal macOS updates without an Apple Developer ID

Alpha-K verifies updates with an Ed25519 key owned by the project. This prevents a substituted GitHub asset from being installed, but it does not make macOS trust the initial download. Install the first release under `~/Applications/Alpha-K.app` and approve it once through the macOS security prompt.

## One-time key setup

The public key is embedded in `src/main/update/update-config.ts`. The corresponding private key must never be committed. Generate a replacement pair only if rotating the release identity:

```bash
pnpm update:keygen -- /private/tmp/alpha-k-update-key
```

Store the base64-encoded private PEM in the GitHub Actions secret `ALPHA_K_UPDATE_PRIVATE_KEY_BASE64`:

```bash
base64 < /private/tmp/alpha-k-update-key/alpha-k-update-private.pem | tr -d '\n'
```

## Release contract

For tag `v0.0.2`, the workflow uploads these assets:

- `Alpha-K-0.0.2-arm64.dmg` for the first manual install;
- `Alpha-K-0.0.2-arm64.zip` for in-app updates;
- `latest.json`, signed by the update private key.

The installed app downloads `latest.json`, verifies its signature and ZIP SHA-256, then launches a small external helper. The helper waits for Alpha-K to exit, preserves the old `.app` as a backup, replaces it, clears quarantine only after verification, and rolls back if the new app does not report ready within 30 seconds.

This release flow needs `GITHUB_TOKEN` and `ALPHA_K_UPDATE_PRIVATE_KEY_BASE64`; it does not need any Apple certificate or notarization secret.
