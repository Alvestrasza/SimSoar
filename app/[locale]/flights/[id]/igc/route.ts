import fs from "node:fs/promises";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {writeAuditLog} from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type IgcDownloadRouteContext = {
  params: Promise<{
    locale: string;
    id: string;
  }>;
};

function safeDownloadPart(value: string | null | undefined, fallback: string) {
  const cleaned = (value ?? fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 80);

  return cleaned || fallback;
}

function buildIgcFileName(flight: {
  id: string;
  pilotCallsign: string;
  startTime: Date | null;
  createdAt: Date;
}) {
  const datePart = (flight.startTime ?? flight.createdAt)
    .toISOString()
    .slice(0, 10);

  const callsignPart = safeDownloadPart(flight.pilotCallsign, "pilot");

  return `${datePart}_${callsignPart}_${flight.id}.igc`;
}

function canPublicDownload(flight: {
  visibility: "PUBLIC" | "PRIVATE" | "UNLISTED";
  moderationStatus: "APPROVED" | "REJECTED" | "HIDDEN" | "PENDING";
  deletedAt: Date | null;
  publicIgcDownloadEnabled: boolean;
}) {
  return (
    flight.publicIgcDownloadEnabled &&
    flight.deletedAt === null &&
    flight.moderationStatus === "APPROVED" &&
    flight.visibility !== "PRIVATE"
  );
}

export async function GET(
  _request: Request,
  {params}: IgcDownloadRouteContext
) {
  const {id} = await params;

  const flight = await prisma.flight.findUnique({
    where: {
      id
    },
    select: {
      id: true,
      userId: true,
      title: true,
      pilotCallsign: true,
      visibility: true,
      publicIgcDownloadEnabled: true,
      moderationStatus: true,
      deletedAt: true,
      igcObjectPath: true,
      igcSha256: true,
      startTime: true,
      createdAt: true
    }
  });

  if (!flight) {
    return new Response("Not found.", {
      status: 404
    });
  }

  let session = null;

  try {
    session = await auth();
  } catch (error) {
    console.error("SimSoar IGC download auth session could not be loaded:", error);
  }

  const isOwner = session?.user?.id === flight.userId;
  const canAdminDownload = hasRole(session?.user?.roles, "ADMIN");
  const isPublicDownload = canPublicDownload(flight);

  const canDownload =
    canAdminDownload ||
    isOwner ||
    isPublicDownload;

  if (!canDownload) {
    return new Response("Not found.", {
      status: 404
    });
  }

  let fileBuffer: Buffer;

  try {
    fileBuffer = await fs.readFile(
      /* turbopackIgnore: true */ flight.igcObjectPath
    );
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    console.error("SimSoar IGC download failed:", {
      flightId: flight.id,
      objectPath: flight.igcObjectPath,
      code,
      error
    });

    return new Response("IGC file not found.", {
      status: 404
    });
  }

  const fileName = buildIgcFileName(flight);

  await writeAuditLog({
    actorUserId: session?.user?.id ?? null,
    actorEmail: session?.user?.email ?? null,
    action: "IGC_DOWNLOAD",
    targetType: "Flight",
    targetId: flight.id,
    summary: "IGC file was downloaded.",
    metadata: {
      title: flight.title,
      pilotCallsign: flight.pilotCallsign,
      visibility: flight.visibility,
      publicIgcDownloadEnabled: flight.publicIgcDownloadEnabled,
      downloadMode: canAdminDownload
        ? "admin"
        : isOwner
          ? "owner"
          : "public",
      fileName,
      igcSha256: flight.igcSha256
    }
  });

  const responseBody = new Uint8Array(fileBuffer.byteLength);
  responseBody.set(fileBuffer);

  return new Response(responseBody, {
    status: 200,
    headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Length": String(fileBuffer.byteLength)
    }
  });
}
