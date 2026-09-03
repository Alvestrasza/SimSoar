import test from "node:test";
import assert from "node:assert/strict";
import {canViewFlightStory, detectStoryImageType, getStoryImageLimits} from "../lib/flight-story.ts";

test("detects supported image formats from signatures rather than declared MIME types", () => {
  assert.deepEqual(detectStoryImageType(Buffer.from([0xff, 0xd8, 0xff, 0x00])), {mimeType: "image/jpeg", extension: "jpg"});
  assert.deepEqual(detectStoryImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), {mimeType: "image/png", extension: "png"});
  assert.deepEqual(detectStoryImageType(Buffer.from("RIFF0000WEBP", "ascii")), {mimeType: "image/webp", extension: "webp"});
  assert.equal(detectStoryImageType(Buffer.from("not an image")), null);
});

test("bounds configurable image limits", () => {
  assert.deepEqual(getStoryImageLimits({SIMSOAR_STORY_MAX_IMAGES: "999", SIMSOAR_STORY_IMAGE_MAX_BYTES: "999999999"}), {
    maxImagesPerFlight: 20,
    maxFileBytes: 10 * 1024 * 1024
  });
});

test("allows public stories while keeping private or moderated flights protected", () => {
  const publicFlight = {userId: "owner", visibility: "PUBLIC", moderationStatus: "APPROVED", deletedAt: null};
  assert.equal(canViewFlightStory(publicFlight, {}), true);
  assert.equal(canViewFlightStory({...publicFlight, visibility: "PRIVATE"}, {}), false);
  assert.equal(canViewFlightStory({...publicFlight, moderationStatus: "HIDDEN"}, {userId: "owner"}), true);
  assert.equal(canViewFlightStory({...publicFlight, visibility: "PRIVATE"}, {canModerate: true}), true);
});
