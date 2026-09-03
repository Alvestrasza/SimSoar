import fs from "node:fs/promises";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {canViewFlightStory} from "@/lib/flight-story";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, {params}: {params: Promise<{id: string; imageId: string}>}) {
  const {id, imageId} = await params;
  const image = await prisma.flightStoryImage.findUnique({
    where: {id: imageId},
    include: {flight: {select: {id: true, userId: true, visibility: true, moderationStatus: true, deletedAt: true}}}
  });
  if (!image || image.flight.id !== id) return new Response("Not found.", {status: 404});

  let session = null;
  try { session = await auth(); } catch (error) { console.error("SimSoar story image auth failed:", error); }
  if (!canViewFlightStory(image.flight, {userId: session?.user?.id, canModerate: hasRole(session?.user?.roles, "MODERATOR")})) {
    return new Response("Not found.", {status: 404});
  }

  try {
    const buffer = await fs.readFile(image.objectPath);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": image.mimeType,
        "Content-Length": String(buffer.length),
        "Cache-Control": image.flight.visibility === "PUBLIC" ? "public, max-age=3600" : "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox"
      }
    });
  } catch (error) {
    console.error("SimSoar story image read failed:", {imageId, code: (error as NodeJS.ErrnoException).code});
    return new Response("Not found.", {status: 404});
  }
}
