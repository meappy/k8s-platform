# Contributing to k8s-platform

Thank you for your interest in contributing to k8s-platform! This document provides guidelines and instructions for contributing to this GitOps/Helm-based Kubernetes platform.

## Getting Started

### Fork and Clone

1. Fork the repository on GitHub.
2. Clone your fork locally:

   ```bash
   git clone git@github.com:<your-username>/k8s-platform.git
   cd k8s-platform
   ```

3. Add the upstream remote:

   ```bash
   git remote add upstream git@github.com:meappy/k8s-platform.git
   ```

4. Configure the Git hooks:

   ```bash
   git config core.hooksPath .githooks
   ```

### Branch Naming

All branches **must** use one of the following prefixes:

- `feat/` — new features or additions (e.g. `feat/add-monitoring-stack`)
- `feature/` — alternative prefix for new features
- `fix/` — bug fixes or corrections (e.g. `fix/traefik-tls-config`)

Direct commits to `main` and `dev` are blocked by the pre-commit hook.

### Conventional Commits

This project follows [Conventional Commits](https://www.conventionalcommits.org/). All commit messages must be structured as:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types:**

- `feat` — a new feature
- `fix` — a bug fix
- `docs` — documentation changes
- `chore` — maintenance tasks (CI, dependencies, etc.)
- `refactor` — code restructuring without behaviour change
- `test` — adding or updating tests

**Examples:**

```
feat(traefik): add rate limiting middleware
fix(cert-manager): correct ClusterIssuer API version
docs: update bootstrap instructions
chore(argocd): bump chart version to 5.51.0
```

## Testing Helm Changes

Before submitting a pull request that modifies Helm charts, please verify your changes locally.

### Lint Charts

```bash
# Lint a specific chart
helm lint infrastructure/traefik/
helm lint infrastructure/argocd/
helm lint infrastructure/cert-manager/

# Lint all infrastructure charts
for chart in infrastructure/*/; do
  helm lint "$chart"
done
```

### Template Rendering

Verify that templates render correctly:

```bash
# Render templates for a chart
helm template traefik infrastructure/traefik/
helm template argocd infrastructure/argocd/ -n argocd

# Render with cluster-specific values
helm template traefik infrastructure/traefik/ \
  -f clusters/mac-mini/traefik-values.yaml
```

### Validate Kubernetes Manifests

If you have `kubeval` or `kubeconform` installed:

```bash
helm template traefik infrastructure/traefik/ | kubeconform -strict
```

## Pull Request Process

1. **Create a branch** from `main` using the required naming convention.
2. **Make your changes** with conventional commit messages.
3. **Test locally** — lint and template-render any modified Helm charts.
4. **Push your branch** and open a pull request against `main`.
5. **Fill in the PR template** — describe your changes, testing performed, and any relevant context.
6. **Address review feedback** — maintainers may request changes before merging.

### PR Guidelines

- Keep pull requests focused — one logical change per PR.
- Update documentation if your change affects the setup or architecture.
- Do not commit secrets, tokens, or credentials. Use `.yaml.example` files for secret templates.
- Ensure all Helm charts pass linting before requesting review.

## Style Guide

- Use **British English** throughout documentation and comments (e.g. "colour", "initialise", "behaviour").
- Follow existing naming conventions for Kubernetes resources and Helm values.
- Keep YAML indentation consistent (2 spaces).

## Questions?

If you have questions or need help, open a [GitHub Issue](https://github.com/meappy/k8s-platform/issues) and we will be happy to assist.
