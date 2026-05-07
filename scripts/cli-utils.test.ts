import { describe, expect, it } from "bun:test";
import {
  getOption,
  getRequiredOptionValue,
  looksLikePositionalChannelKind,
  wantsHelp,
} from "./cli-utils";

describe("cli-utils", () => {
  describe("wantsHelp", () => {
    it("detects long help flag", () => {
      expect(wantsHelp(["add-channel", "--help"])).toBe(true);
    });

    it("detects short help flag", () => {
      expect(wantsHelp(["update", "-h"])).toBe(true);
    });

    it("returns false when help is absent", () => {
      expect(wantsHelp(["groups", "info", "~zod/test"])).toBe(false);
    });
  });

  describe("looksLikePositionalChannelKind", () => {
    it("detects channel kind passed positionally", () => {
      const args = ["add-channel", "~zod/test", "chat", "Projects"];
      expect(looksLikePositionalChannelKind(args, 2)).toBe(true);
    });

    it("does not flag valid --kind usage", () => {
      const args = ["add-channel", "~zod/test", "Projects", "--kind", "chat"];
      expect(looksLikePositionalChannelKind(args, 2)).toBe(false);
      expect(getOption(args, "kind")).toBe("chat");
    });

    it("does not flag ordinary titles", () => {
      const args = ["add-channel", "~zod/test", "Projects"];
      expect(looksLikePositionalChannelKind(args, 2)).toBe(false);
    });
  });

  describe("getRequiredOptionValue", () => {
    it("returns the following option value", () => {
      expect(getRequiredOptionValue(["--content", "story.json"], 0)).toBe("story.json");
    });

    it("fails when the option value is missing", () => {
      expect(() => getRequiredOptionValue(["--content"], 0)).toThrow(
        "--content requires a value"
      );
    });

    it("fails when the next token is another option", () => {
      expect(() => getRequiredOptionValue(["--content", "--markdown", "post.md"], 0)).toThrow(
        "--content requires a value"
      );
    });
  });
});
