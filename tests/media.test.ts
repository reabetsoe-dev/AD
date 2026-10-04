import { test } from "node:test";
import assert from "node:assert/strict";
import { linkedMediaType, mediaCategoryFor, mediaLinkUrl } from "../lib/media";

test("media links allow web URLs and reject executable schemes and embedded credentials", () => {
  assert.equal(mediaLinkUrl("https://example.com/video?id=2"), "https://example.com/video?id=2");
  assert.equal(mediaLinkUrl("http://example.com/photo.jpg"), "http://example.com/photo.jpg");
  for (const value of ["javascript:alert(1)", "data:text/html,test", "file:///test", "/relative", "https://user:password@example.com", "invalid"])
    assert.equal(mediaLinkUrl(value), null, value);
});

test("direct media links are identified from their pathname including query strings", () => {
  assert.equal(linkedMediaType("https://example.com/PHOTO.JPG?download=1"), "image");
  assert.equal(linkedMediaType("https://example.com/video.mp4?token=temporary"), "video");
  assert.equal(linkedMediaType("https://example.com/speech.mp3"), "audio");
  assert.equal(linkedMediaType("https://example.com/press.pdf"), "document");
  assert.equal(linkedMediaType("https://www.youtube.com/watch?v=example"), null);
});

test("explicit media categories take priority and legacy attachments remain categorized", () => {
  assert.equal(mediaCategoryFor({ mediaCategory: "speeches", attachmentCategory: "video" }), "speeches");
  assert.equal(mediaCategoryFor({ attachmentCategory: "video" }), "videos");
  assert.equal(mediaCategoryFor({ attachmentCategory: "audio" }), "speeches");
  assert.equal(mediaCategoryFor({ attachmentCategory: "document" }), "press");
  assert.equal(mediaCategoryFor({ attachmentCategory: "image" }), "photos");
  assert.equal(mediaCategoryFor({ externalUrl: "https://example.com/press.pdf" }), "press");
  assert.equal(mediaCategoryFor({}), "photos");
});
