#!/usr/bin/env bash
set -euo pipefail

DOTFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LINKED=()
BACKED_UP=()

info()  { printf '\033[1;34m[info]\033[0m  %s\n' "$1"; }
ok()    { printf '\033[1;32m[ok]\033[0m    %s\n' "$1"; }
warn()  { printf '\033[1;33m[warn]\033[0m  %s\n' "$1"; }

backup_and_link() {
  local src="$1"
  local dest="$2"

  # Already linked correctly
  if [ -L "$dest" ] && [ "$(readlink "$dest")" = "$src" ]; then
    ok "Already linked: $dest"
    return
  fi

  # Create parent directory if needed
  mkdir -p "$(dirname "$dest")"

  # Backup existing file or symlink
  if [ -e "$dest" ] || [ -L "$dest" ]; then
    mv "$dest" "${dest}.bak"
    warn "Backed up: $dest -> ${dest}.bak"
    BACKED_UP+=("$dest")
  fi

  ln -s "$src" "$dest"
  ok "Linked: $dest -> $src"
  LINKED+=("$dest")
}

# 1. Install Homebrew
info "Checking Homebrew..."
if ! command -v brew &>/dev/null; then
  info "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  eval "$(/opt/homebrew/bin/brew shellenv)"
else
  ok "Homebrew already installed"
fi

# 2. Install packages from Brewfile
info "Installing packages from Brewfile..."
brew bundle --file="$DOTFILES_DIR/Brewfile"

# 3. Install Oh My Zsh
info "Checking Oh My Zsh..."
if [ ! -d "$HOME/.oh-my-zsh" ]; then
  info "Installing Oh My Zsh..."
  RUNZSH=no KEEP_ZSHRC=no sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
else
  ok "Oh My Zsh already installed"
fi

# 4. Symlink config files
info "Linking config files..."
backup_and_link "$DOTFILES_DIR/config/git/.gitconfig"        "$HOME/.gitconfig"
backup_and_link "$DOTFILES_DIR/config/git/ignore"            "$HOME/.config/git/ignore"
backup_and_link "$DOTFILES_DIR/config/zsh/.zshrc"            "$HOME/.zshrc"
backup_and_link "$DOTFILES_DIR/config/starship/starship.toml" "$HOME/.config/starship.toml"
backup_and_link "$DOTFILES_DIR/config/ghostty/config"        "$HOME/.config/ghostty/config"
backup_and_link "$DOTFILES_DIR/config/gh/config.yml"              "$HOME/.config/gh/config.yml"
backup_and_link "$DOTFILES_DIR/config/ccstatusline/settings.json" "$HOME/.config/ccstatusline/settings.json"

# 5. Install latest LTS Node via fnm
info "Setting up Node.js via fnm..."
eval "$(fnm env --use-on-cd --shell bash)"
fnm install --lts
fnm default lts-latest
ok "Node $(fnm current) set as default"

# 6. Install Claude Code
info "Checking Claude Code..."
if ! command -v claude &>/dev/null; then
  info "Installing Claude Code..."
  npm install -g @anthropic-ai/claude-code
  ok "Claude Code installed"
else
  ok "Claude Code already installed ($(claude --version))"
fi

# 7. Symlink Claude Code config
info "Linking Claude Code config..."
backup_and_link "$DOTFILES_DIR/config/claude/CLAUDE.md"      "$HOME/.claude/CLAUDE.md"
backup_and_link "$DOTFILES_DIR/config/claude/settings.json"  "$HOME/.claude/settings.json"

# 8. Summary
echo ""
info "Setup complete!"
echo ""
echo "  Linked:    ${#LINKED[@]} file(s)"
echo "  Backed up: ${#BACKED_UP[@]} file(s)"
if [ ${#BACKED_UP[@]} -gt 0 ]; then
  echo ""
  echo "  Backup files (*.bak):"
  for f in "${BACKED_UP[@]}"; do
    echo "    ${f}.bak"
  done
fi
echo ""
echo "  Restart your terminal or run: source ~/.zshrc"
