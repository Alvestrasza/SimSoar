import fs from "node:fs/promises";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {writeAuditLog} from "@/lib/audit";
import {
  buildIgcFileName,
  resolveIgcDownloadMode
} from "@/lib/igc-download";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type IgcDownloadRouteContext = {
  params: Promise<{
    locale: string;
    id: string;
  }>;
};

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

  const downloadMode = resolveIgcDownloadMode(flight, {
    userId: session?.user?.id,
    isAdmin: hasRole(session?.user?.roles, "ADMIN")
  });

  if (!downloadMode) {
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
      downloadMode,
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
