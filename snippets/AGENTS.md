# PPT Snippets Library (`snippets/`)

## Purpose & Scope

The `snippets/` directory contains modular, editable YAML templates and boilerplate motifs used by PPT Studio for:
1. **Contextual Autocomplete (`Ctrl+Space`)**: Suggesting context-relevant structures (root scores, knot headers, weaves, coils, layers, and engraving settings).
2. **Command Palette (`Ctrl+Shift+P` / `F1`)**: Exposing one-click snippet insertions into the active score.

---

## Snippet YAML Schema

Each file in `snippets/*.yaml` defines a snippet template with the following attributes:

```yaml
id: snip-example-id              # Unique string ID
label: Example Snippet Label     # Full search label in autocomplete & palette
displayText: Example Snippet     # Compact badge label in CodeMirror hint popup
desc: Short description of motif # Tooltip/description text
category: Snippets               # Category in Command Palette (default: Snippets)
icon: 🎵                         # Emoji/icon displayed in Command Palette
context:                         # Array of scopes where autocomplete suggests this snippet
  - root                         # At column 0 / top-level (tapestry, knot, knots)
  - top                          # Top of document
  - knots                        # Inside `knots:` list/dictionary
  - knot                         # Inside `knot:` definition block
  - weaves                       # Inside `weaves:` section
  - weave-body                   # Inside a weave definition block
  - children                     # Inside a `children:` list
  - coils                        # Inside `coils:` dictionary
  - coil-body                    # Inside a coil definition block
  - engraving                    # Inside `engraving:` or `show:` configuration
snippet: |                       # Multi-line template text (auto-indents to cursor column)
  property: value
```

---

## Adding New Snippets

To add a new snippet:
1. Create a new `.yaml` file in `snippets/` (e.g. `snippets/bass-groove.yaml`).
2. Specify `id`, `label`, `displayText`, `desc`, `context`, and the `snippet` multiline string.
3. PPT Studio automatically loads all snippets from `/api/snippets` on startup without requiring code edits or server restarts!
