# Dotfiles

## Project Structure

This is a macOS dotfiles repo. Config files live under `config/` and are symlinked to their expected locations by `install.sh`.

Key paths:
- `config/starship/starship.toml` → `~/.config/starship.toml`
- `config/ghostty/config` → `~/.config/ghostty/config`
- `config/zsh/.zshrc` → `~/.zshrc`
- `config/git/.gitconfig` → `~/.gitconfig`
- `config/claude/CLAUDE.md` → `~/.claude/CLAUDE.md`

## Rules

### Nerd Font Glyphs in Starship Config

`config/starship/starship.toml` contains Nerd Font glyphs (powerline arrows, language icons, OS icons, etc.) in the Unicode Private Use Area (U+E000..U+F8FF, U+F0000..U+FFFFD). These characters are invisible or render as boxes in many editors and terminals.

When editing `starship.toml`, never copy/paste through tools or editors that strip non-standard Unicode characters. Always verify after editing that the Nerd Font codepoints are preserved (e.g., `python3 -c "print([hex(ord(c)) for c in open('file').read() if ord(c) > 0x7F])"` should show codepoints like `0xe0b0`, `0xf418`, etc.).
