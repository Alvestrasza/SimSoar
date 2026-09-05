import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {readJournalImage} from "@/lib/journal-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const privateHeaders = {"Cache-Control": "private, no-store, max-age=0", "Vary": "Cookie", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox", "Cross-Origin-Resource-Policy": "same-origin"};
function missing() { return new Response("Not found.", {status: 404, headers: privateHeaders}); }

export async function GET(_request: Request, {params}: {params: Promise<{imageId: string}>}) {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) return missing();
  const {imageId} = await params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(imageId)) return missing();
  const image = await prisma.journalImage.findFirst({where: {id: imageId, userId: session.user.id}, select: {storageKey: true, sizeBytes: true}});
  if (!image) return missing();
  try {
    const buffer = await readJournalImage(image.storageKey, session.user.id);
    if (buffer.length !== image.sizeBytes) return missing();
    return new Response(new Uint8Array(buffer), {headers: {...privateHeaders, "Content-Type": "image/webp", "Content-Length": String(buffer.length), "Content-Disposition": 'inline; filename="journal-image.webp"'}});
  } catch { return missing(); }
}
