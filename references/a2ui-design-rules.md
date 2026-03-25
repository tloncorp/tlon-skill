# A2UI Design Rules

Follow these rules exactly when generating A2UI blobs for Tlon.

## Font Rules

**NEVER reference fonts in blob JSON.** The renderer handles fonts using the Ochre system font stack. Never add `fontFamily` props to blob JSON components.

## Spacing Tokens

Ochre spacing tokens:
| Token | Value |
|-------|-------|
| `$2xs` | 2px |
| `$xs`  | 4px |
| `$s`   | 6px |
| `$m`   | 8px |
| `$l`   | 12px |
| `$xl`  | 16px |
| `$2xl` | 24px |
| `$3xl` | 32px |

In blob JSON use shorthand strings: `"xs"`, `"sm"`, `"md"`, `"lg"`.

## Color Rules

### Buttons
- **Primary**: `#4E91F5` solid blue, white text
- **Secondary**: system background with border

### Badges
- **default**: neutral gray
- **primary**: `#143A5E` bg + `#4E91F5` text
- **success**: `#1B3D2A` bg + `#3FB950` text

### Charts — recommended color palette (use in order)
```
#4E91F5  blue
#3FB950  green
#E3B341  yellow
#E96A6A  red
#A78BFA  purple
#F09860  orange
```

## Layout Rules

- Section headers: `size: "xs"`, `color: "$tertiaryText"`
- Add Dividers between major sections
- Chart height: 180–220 recommended inside cards (max 300)
- Use `paddingVertical` for symmetry, never only `paddingBottom`

## Chart Rules

| Chart type | Series format | xLabels |
|------------|--------------|---------|
| bar | `values: [N, N, N]` — one per x-label | required |
| line | `values: [N, N, N]` — one per x-label | required |
| area | `values: [N, N, N]` — one per x-label | required |
| pie | `values: [N]` — one total per series | NOT used |
| sparkline | single series | optional |

**PIE RULE:** Each slice is a separate series with `values:[singleNumber]`. Never multiple values in one series for pie.

## Common Mistakes

1. Pie using xLabels instead of per-series labels
2. Bar/line series length not matching xLabels count
3. Blob not wrapped in array `[{...}]`
4. Missing `version: 1`
5. Using pixel numbers for gap instead of token strings
