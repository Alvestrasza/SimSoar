import sharp from "sharp";
import {JOURNAL_MAX_IMAGE_BYTES, JOURNAL_MAX_PIXELS, validateJournalImageDimensions, validateJournalImageInput} from "./journal-policy.ts";

export async function prepareJournalImageData(input: Buffer, declaredType: string) {
  validateJournalImageInput(input, declaredType);
  try {
    const decoder = sharp(input, {limitInputPixels: JOURNAL_MAX_PIXELS, failOn: "warning", animated: false});
    const metadata = await decoder.metadata();
    validateJournalImageDimensions(metadata.width, metadata.height, metadata.pages ?? 1);
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? "")) throw new Error("image_type");
    // Decode and re-encode to remove trailing payloads and EXIF/GPS metadata.
    const {data: buffer, info} = await decoder.rotate().webp({quality: 85}).toBuffer({resolveWithObject: true});
    validateJournalImageDimensions(info.width, info.height);
    if (buffer.length > JOURNAL_MAX_IMAGE_BYTES) throw new Error("image_size");
    return {buffer, sizeBytes: buffer.length, width: info.width, height: info.height};
  } catch (error) {
    if (error instanceof Error && ["image_size", "image_type", "image_dimensions"].includes(error.message)) throw error;
    throw new Error("image_invalid");
  }
}
