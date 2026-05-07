import { describe, expect, it } from "bun:test";
import { normalizeNotebookContent } from "./notebook-content";

describe("normalizeNotebookContent", () => {
  it("keeps Story content unchanged", () => {
    const story = [{ inline: ["Body"] }];

    expect(normalizeNotebookContent(story)).toEqual(story);
  });

  it("accepts empty Story content", () => {
    expect(normalizeNotebookContent([])).toEqual([]);
  });

  it("accepts supported Story block and inline shapes", () => {
    const story = [
      { inline: ["Use ", { "inline-code": "ha-q" }, " here"] },
      { block: { header: { tag: "h2", content: [{ bold: ["Title"] }] } } },
      { block: { code: { code: "const value = 1;", lang: "ts" } } },
      {
        block: {
          image: { src: "https://example.com/image.png", height: 100, width: 200, alt: "" },
        },
      },
      { block: { rule: null } },
    ];

    expect(normalizeNotebookContent(story)).toEqual(story);
  });

  it("rejects ProseMirror-style rich-text JSON instead of guessing", () => {
    expect(() =>
      normalizeNotebookContent({
        type: "doc",
        content: [{ type: "paragraph", content: [{ text: "Body" }] }],
      })
    ).toThrow("Unsupported notebook content JSON");
  });

  it("rejects invalid Story-shaped content", () => {
    expect(() => normalizeNotebookContent([{ block: {} }])).toThrow(
      "Unsupported notebook content JSON"
    );

    expect(() => normalizeNotebookContent([{ inline: [{ unknown: "Body" }] }])).toThrow(
      "Unsupported notebook content JSON"
    );
  });

  it("rejects unsupported explicit content instead of returning title-only content", () => {
    expect(() => normalizeNotebookContent({ unsupported: true })).toThrow(
      "Unsupported notebook content JSON"
    );
  });
});
