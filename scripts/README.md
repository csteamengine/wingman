# Wingman Scripts

Helper scripts for development, building, and releasing Wingman.

## 🚀 Release Scripts

### Quick Release
```bash
./scripts/release.sh 0.2.0
```
Fast release: bumps version, commits, tags, and pushes (triggers GitHub Actions).

### Interactive Release
```bash
./scripts/release-interactive.sh
```
Guided release process with CHANGELOG support and confirmations at each step.

### Version Management
```bash
./scripts/bump-version.sh
```
Update version across all files (package.json, Cargo.toml, tauri.conf.json).

### Changelog
```bash
./scripts/create-changelog-entry.sh
```
Add a new entry to CHANGELOG.md for the current version.

## 🔨 Build Scripts

### Build Signed Release (Local)
```bash
./scripts/build-release.sh
```
Builds a signed release locally. Requires private key setup first.

### Generate Update Manifest
```bash
./scripts/generate-update-manifest.sh
```
Creates `latest.json` from built artifacts for auto-updates.

### Setup Signing Key
```bash
./scripts/setup-signing-key.sh
```
Saves your Tauri private signing key to `~/.tauri/wingman-private-key.txt`.

## 📋 Typical Workflows

### Creating a New Release (GitHub Actions)

**Option 1: Quick (Recommended)**
```bash
# One command release
./scripts/release.sh 0.2.0

# GitHub Actions will:
# - Build for all platforms
# - Sign binaries
# - Create release
# - Generate latest.json
```

**Option 2: Interactive**
```bash
# Step-by-step with changelog
./scripts/release-interactive.sh

# Follow prompts to:
# - Bump version
# - Add changelog entries
# - Commit and tag
# - Push to trigger CI
```

**Option 3: Manual Tag**
```bash
# Bump version manually
./scripts/bump-version.sh

# Edit CHANGELOG.md
./scripts/create-changelog-entry.sh

# Commit and push
git commit -am "chore: Release v0.2.0"
git tag v0.2.0
git push && git push --tags

# GitHub Actions triggers automatically
```

### Local Signed Build

```bash
# 1. Setup signing key (one-time)
./scripts/setup-signing-key.sh
# (Or add key to PRIVATE_KEY.txt)

# 2. Build signed release
./scripts/build-release.sh

# 3. Generate update manifest
./scripts/generate-update-manifest.sh

# 4. Upload to GitHub release manually
```

## 🔐 GitHub Secrets Required

For GitHub Actions to work, add these secrets at:
https://github.com/csteamengine/wingman/settings/secrets/actions

- `TAURI_PRIVATE_KEY` - Your Tauri signing private key
- `TAURI_KEY_PASSWORD` - Password for the key (empty string `""` for our setup)

## 📦 What Gets Built

### Platforms
- **macOS**: ARM64 + Intel (.dmg + .app.tar.gz + signatures)
- **Windows**: x64 (.exe + .msi + .nsis.zip + signatures)
- **Linux**: x64 (.deb + .AppImage + .tar.gz + signatures)

### Auto-Update Files
- `.app.tar.gz` / `.nsis.zip` / `.AppImage.tar.gz` - Update bundles
- `.sig` files - Cryptographic signatures
- `latest.json` - Update manifest

## 🐛 Troubleshooting

### "Private key not found"
Run `./scripts/setup-signing-key.sh` or create `PRIVATE_KEY.txt` with your key.

### "Version already exists"
Delete the tag locally and remotely:
```bash
git tag -d v0.2.0
git push --delete origin v0.2.0
```

### GitHub Actions fails to build
- Check secrets are set correctly
- View logs: https://github.com/csteamengine/wingman/actions
- Ensure version numbers match in all files

## 📚 More Info

- **Update System**: See `UPDATES.md` for auto-update documentation
- **Release Checklist**: See `RELEASE-CHECKLIST.md` for step-by-step guide
- **Private Key**: See `PRIVATE_KEY.README.md` for key management
