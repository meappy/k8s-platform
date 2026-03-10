# Contributing

Thanks for your interest in contributing! This guide covers how to get started.

## Getting Started

### 1. Fork and Clone

Fork the repo on GitHub, then:

```bash
git clone https://github.com/YOUR_USERNAME/k8s-platform.git
cd k8s-platform
git remote add upstream https://github.com/meappy/k8s-platform.git
```

### 2. Create a Branch

Always work on a feature branch, never commit directly to `main`.

```bash
git fetch upstream
git checkout -b feat/my-feature upstream/main
```

Branch naming conventions:
- `feat/description` — New features
- `fix/description` — Bug fixes
- `docs/description` — Documentation changes
- `refactor/description` — Code refactoring

### 3. Commit Messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add support for new feature
fix: correct broken behaviour
docs: update setup instructions
refactor: simplify configuration logic
```

- `fix:` — Triggers a patch version bump
- `feat:` — Triggers a minor version bump
- `BREAKING CHANGE:` in the commit body — Triggers a major version bump

## Submitting a Pull Request

1. Push your branch to your fork:
   ```bash
   git push origin feat/my-feature
   ```
2. Open a pull request against `main` on the upstream repo.
3. In the PR description, summarise what the change does and why.
4. Make sure CI checks pass.

## Need Help?

Open an [issue](https://github.com/meappy/k8s-platform/issues) for bugs or feature requests.
