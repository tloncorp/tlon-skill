import { describe, expect, it } from "bun:test";
import { normalizeNotebookContent } from "./notebook-content";

describe("normalizeNotebookContent", () => {
  it("keeps Story content unchanged", () => {
    const story = [{ inline: ["Body"] }];

    expect(normalizeNotebookContent(story)).toEqual(story);
  });

  it("converts recognized rich-text content", () => {
    expect(
      normalizeNotebookContent({
        content: [{ type: "paragraph", content: [{ text: "Body" }] }],
      })
    ).toEqual([{ inline: ["Body"] }]);
  });

  it("preserves markdown-looking text in rich-text paragraphs", () => {
    expect(
      normalizeNotebookContent({
        content: [
          { type: "paragraph", content: [{ text: "# todo" }] },
          { type: "paragraph", content: [{ text: "> quote" }] },
          { type: "paragraph", content: [{ text: "```js" }] },
        ],
      })
    ).toEqual([{ inline: ["# todo"] }, { inline: ["> quote"] }, { inline: ["```js"] }]);
  });

  it("converts rich-text headings to Story headers", () => {
    expect(
      normalizeNotebookContent({
        content: [{ type: "heading", attrs: { level: 2 }, content: [{ text: "Title" }] }],
      })
    ).toEqual([{ block: { header: { tag: "h2", content: ["Title"] } } }]);
  });

  it("preserves rich-text marks on text nodes", () => {
    expect(
      normalizeNotebookContent({
        content: [
          {
            type: "paragraph",
            content: [
              { text: "Bold", marks: [{ type: "bold" }] },
              { text: " " },
              { text: "Italic", marks: [{ type: "italic" }] },
              { text: " " },
              { text: "Strike", marks: [{ type: "strike" }] },
              { text: " " },
              { text: "Code", marks: [{ type: "code" }] },
              { text: " " },
              { text: "Link", marks: [{ type: "link", attrs: { href: "https://example.com" } }] },
            ],
          },
        ],
      })
    ).toEqual([
      {
        inline: [
          { bold: ["Bold"] },
          " ",
          { italics: ["Italic"] },
          " ",
          { strike: ["Strike"] },
          " ",
          { "inline-code": "Code" },
          " ",
          { link: { href: "https://example.com", content: "Link" } },
        ],
      },
    ]);
  });

  it("preserves links when text nodes also have style marks", () => {
    expect(
      normalizeNotebookContent({
        content: [
          {
            type: "paragraph",
            content: [
              {
                text: "Styled link",
                marks: [{ type: "link", attrs: { href: "https://example.com" } }, { type: "bold" }],
              },
            ],
          },
        ],
      })
    ).toEqual([
      {
        inline: [{ bold: [{ link: { href: "https://example.com", content: "Styled link" } }] }],
      },
    ]);
  });

  it("fails invalid Story-shaped content", () => {
    expect(() => normalizeNotebookContent([{ block: {} }])).toThrow(
      "Unsupported notebook content JSON"
    );
  });

  it("fails unsupported explicit content instead of returning title-only content", () => {
    expect(() => normalizeNotebookContent({ unsupported: true })).toThrow(
      "Unsupported notebook content JSON"
    );
  });
});
