# dotfiles

Shell script and configuration files to restore a macOS developer environment on a fresh MacBook. Focused on git, Node.js, Ghostty, and zsh tooling.

## Prerequisites

- macOS (Apple Silicon)
- Command Line Tools (`xcode-select --install`)

## Quick Start

```bash
git clone https://github.com/<your-username>/dotfiles.git ~/dotfiles
cd ~/dotfiles
./install.sh
```

## What Gets Installed

**Via Homebrew:**

| Category | Packages |
|----------|----------|
| CLI essentials | git, gh, jq, tree, ripgrep, fzf |
| Shell and prompt | starship, zoxide, direnv |
| Node.js | fnm, node, pnpm |
| Apps | Ghostty, JetBrains Mono Nerd Font |

**Additionally:**

- Oh My Zsh (with git plugin)
- Latest LTS Node.js (via fnm)
- Claude Code (via npm)

## Config File Mapping

Each config file in this repo is symlinked to its expected location.

| Repo path | Symlink target |
|-----------|---------------|
| `config/git/.gitconfig` | `~/.gitconfig` |
| `config/git/ignore` | `~/.config/git/ignore` |
| `config/zsh/.zshrc` | `~/.zshrc` |
| `config/starship/starship.toml` | `~/.config/starship.toml` |
| `config/ghostty/config` | `~/.config/ghostty/config` |
| `config/gh/config.yml` | `~/.config/gh/config.yml` |
| `config/ccstatusline/settings.json` | `~/.config/ccstatusline/settings.json` |
| `config/claude/CLAUDE.md` | `~/.claude/CLAUDE.md` |
| `config/claude/settings.json` | `~/.claude/settings.json` |

## How It Works

The `install.sh` script is idempotent and safe to re-run:

1. Installs Homebrew if not present
2. Runs `brew bundle` with the included Brewfile
3. Installs Oh My Zsh if not present
4. Symlinks all config files (existing files are backed up to `.bak`)
5. Installs the latest LTS Node.js via fnm
6. Installs Claude Code globally via npm
7. Symlinks Claude Code config (`CLAUDE.md` and `settings.json`)

If a symlink already points to the correct target, it is skipped. If an existing file would be overwritten, it is moved to `<filename>.bak` first.

## Customization

- **Git identity:** Edit `config/git/.gitconfig` with your name and email.
- **Shell prompt:** The Starship config uses a Catppuccin Latte palette. Switch palettes by changing the `palette` value in `config/starship/starship.toml`.
- **Terminal:** Ghostty theme and font settings live in `config/ghostty/config`.
- **Brewfile:** Add or remove packages to fit your workflow, then re-run `brew bundle`.
- **Claude Code:** Global rules live in `config/claude/CLAUDE.md`. Permissions, model, and plugin settings are in `config/claude/settings.json`.
