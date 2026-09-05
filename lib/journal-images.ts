import "server-only";
import {JOURNAL_MAX_IMAGE_BYTES} from "@/lib/journal-policy";
import {prepareJournalImageData} from "@/lib/journal-image-processing";

export async function prepareJournalImage(file: File) {
  if (file.size <= 0 || file.size > JOURNAL_MAX_IMAGE_BYTES) throw new Error("image_size");
  const input = Buffer.from(await file.arrayBuffer());
  return prepareJournalImageData(input, file.type);
}
