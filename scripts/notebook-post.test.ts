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

  it("fails unsupported explicit content instead of returning title-only content", () => {
    expect(() => normalizeNotebookContent({ unsupported: true })).toThrow(
      "Unsupported notebook content JSON"
    );
  });
});
