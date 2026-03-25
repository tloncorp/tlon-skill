# A2UI Component Reference

A2UI blobs are structured JSON arrays that Tlon renders as native interactive cards. The blob field is a JSON string.

## Blob Envelope

Every A2UI blob is a **JSON array** containing one object:

```json
[{
  "type": "a2ui",
  "version": 1,
  "root": "root",
  "title": "Card Title",
  "icon": "📊",
  "components": [
    {"id": "root", "component": { "Column": { "children": ["child1", "child2"], "gap": "sm" } }},
    {"id": "child1", "component": { "Text": { "text": "Hello", "size": "sm" } }}
  ]
}]
```

**Required fields:**
- `type`: always `"a2ui"`
- `version`: always `1`
- `root`: id of the root component (usually `"root"`)
- `components`: flat array of `{id, component}` objects

**Optional fields:**
- `title`: shown in card header
- `icon`: emoji icon in header

---

## Component Types

Each component object has exactly one key (the type name) with a props object.

### Column
Vertical stack.
```json
{"Column": {"children": ["id1", "id2"], "gap": "xs"}}
```
- `children`: array of component ids
- `gap`: `"xs"` | `"sm"` | `"md"` | `"lg"`

### Row
Horizontal stack.
```json
{"Row": {"children": ["id1", "id2"], "gap": "xs", "justify": "between"}}
```
- `justify`: `"start"` | `"end"` | `"center"` | `"between"`

### Text
```json
{"Text": {"text": "Hello world", "size": "sm", "color": "$secondaryText"}}
```
- `size`: `"xs"` | `"sm"` | `"md"` | `"lg"` | `"xl"`
- `color`: Ochre token like `"$primaryText"`, `"$secondaryText"`, `"$tertiaryText"`

### Chart
```json
{"Chart": {
  "chartType": "bar",
  "series": [
    {"label": "Alice", "values": [5, 8, 3], "color": "#4E91F5"}
  ],
  "xLabels": ["W1", "W2", "W3"],
  "yLabel": "PRs",
  "height": 180
}}
```
- `chartType`: `"bar"` | `"line"` | `"area"` | `"pie"` | `"sparkline"`
- **Bar/Line/Area**: `series[].values` length MUST match `xLabels` length
- **Pie**: each series = one slice. `values:[N]` (single number). Do NOT use `xLabels` for pie.
- `height`: 120–300 recommended

### Table
```json
{"Table": {
  "columns": ["Person", "W1", "W2"],
  "rows": [
    ["Alice", 5, 8],
    ["Bob", 2, 4]
  ],
  "style": "rich"
}}
```
- `style`: `"simple"` | `"rich"` (rich shows proportional mini-bars)

### Badge
```json
{"Badge": {"text": "shipped", "variant": "success"}}
```
- `variant`: `"default"` | `"primary"` | `"success"`

### Button
```json
{"Button": {"label": "Approve", "action": "approve", "variant": "primary"}}
```
- `variant`: `"primary"` | `"secondary"`
- `action`: string sent to %a2ui agent on tap

### Divider
```json
{"Divider": {}}
```

### Spacer
```json
{"Spacer": {"size": "sm"}}
```
- `size`: `"sm"` | `"md"` | `"lg"`

---

## Chart Type Rules (Critical)

### Pie Chart — CORRECT
Each series = one slice. One value per series.
```json
"series": [
  {"label": "Alice", "values": [36], "color": "#4E91F5"},
  {"label": "Bob",   "values": [24], "color": "#3FB950"}
]
```
**No `xLabels` for pie charts.**

### Pie Chart — WRONG (do not do this)
```json
"series": [{"label": "All", "values": [36, 24, 18]}],
"xLabels": ["Alice", "Bob", "Carol"]
```

### Bar/Line/Area Chart — CORRECT
All series must have same number of values as `xLabels`.
```json
"series": [
  {"label": "Alice", "values": [5, 8, 3]},
  {"label": "Bob",   "values": [2, 4, 7]}
],
"xLabels": ["W1", "W2", "W3"]
```

---

## Full Working Examples

### Decision Card
```json
[{"type":"a2ui","version":1,"root":"root","title":"Deploy to Production?","icon":"🚀","components":[
  {"id":"root","component":{"Column":{"children":["body","divider","btns"],"gap":"sm"}}},
  {"id":"body","component":{"Text":{"text":"v2.4.1 is ready. 12 PRs merged, all tests passing.","size":"sm","color":"$secondaryText"}}},
  {"id":"divider","component":{"Divider":{}}},
  {"id":"btns","component":{"Row":{"children":["yes","no"],"gap":"xs"}}},
  {"id":"yes","component":{"Button":{"label":"Deploy","action":"deploy","variant":"primary"}}},
  {"id":"no","component":{"Button":{"label":"Hold","action":"hold","variant":"secondary"}}}
]}]
```

### Bar Chart with Table
```json
[{"type":"a2ui","version":1,"root":"root","title":"Weekly PRs","icon":"📊","components":[
  {"id":"root","component":{"Column":{"children":["chart","divider","table"],"gap":"xs"}}},
  {"id":"chart","component":{"Chart":{"chartType":"bar","series":[
    {"label":"Alice","values":[5,8,3],"color":"#4E91F5"},
    {"label":"Bob","values":[2,4,7],"color":"#3FB950"}
  ],"xLabels":["W1","W2","W3"],"yLabel":"PRs","height":180}}},
  {"id":"divider","component":{"Divider":{}}},
  {"id":"table","component":{"Table":{"columns":["Person","W1","W2","W3"],"rows":[["Alice",5,8,3],["Bob",2,4,7]],"style":"rich"}}}
]}]
```

### Pie Chart
```json
[{"type":"a2ui","version":1,"root":"root","title":"Commits by Person","icon":"🥧","components":[
  {"id":"root","component":{"Column":{"children":["chart","badges"],"gap":"xs"}}},
  {"id":"chart","component":{"Chart":{"chartType":"pie","series":[
    {"label":"Alice","values":[36],"color":"#4E91F5"},
    {"label":"Bob","values":[24],"color":"#3FB950"},
    {"label":"Carol","values":[18],"color":"#E3B341"}
  ],"height":200}}},
  {"id":"badges","component":{"Row":{"children":["b1"],"gap":"xs"}}},
  {"id":"b1","component":{"Badge":{"text":"78 total","variant":"primary"}}}
]}]
```
