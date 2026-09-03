export type StoryImageLimits = {
  maxImagesPerFlight: number;
  maxFileBytes: number;
};

const ABSOLUTE_MAX_IMAGES = 20;
const ABSOLUTE_MAX_FILE_BYTES = 10 * 1024 * 1024;

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getStoryImageLimits(environment: NodeJS.ProcessEnv = process.env): StoryImageLimits {
  return {
    maxImagesPerFlight: Math.min(positiveInteger(environment.SIMSOAR_STORY_MAX_IMAGES, 8), ABSOLUTE_MAX_IMAGES),
    maxFileBytes: Math.min(positiveInteger(environment.SIMSOAR_STORY_IMAGE_MAX_BYTES, 5 * 1024 * 1024), ABSOLUTE_MAX_FILE_BYTES)
  };
}

export function detectStoryImageType(buffer: Buffer): {mimeType: string; extension: string} | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return {mimeType: "image/png", extension: "png"};
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return {mimeType: "image/jpeg", extension: "jpg"};
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return {mimeType: "image/webp", extension: "webp"};
  }
  return null;
}

export function canViewFlightStory(flight: {
  userId: string;
  visibility: "PUBLIC" | "PRIVATE" | "UNLISTED";
  moderationStatus: "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN";
  deletedAt: Date | null;
}, viewer: {userId?: string; canModerate?: boolean}) {
  return viewer.canModerate === true || viewer.userId === flight.userId || (
    flight.deletedAt === null &&
    flight.moderationStatus === "APPROVED" &&
    (flight.visibility === "PUBLIC" || flight.visibility === "UNLISTED")
  );
}
