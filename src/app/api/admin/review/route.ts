import { NextResponse } from "next/server";
import { db } from "@/lib/data/db";
import { clearPlatformCache } from "@/lib/data/repository";
import { isAuthorised, adminConfigured } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

/**
 * The approval gate (section 43).
 *
 * A pending statistic becomes public only through this endpoint, and only with
 * a reviewer recorded against it. Rejection keeps the row -- a rejected
 * calculation is part of the audit trail, not something to erase.
 */
export async function POST(request: Request) {
  if (!adminConfigured()) {
    return NextResponse.json(
      { error: "Admin interface is disabled. Set ADMIN_TOKEN (32+ chars) to enable it." },
      { status: 503 },
    );
  }
  if (!isAuthorised(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = db();
  if (!sql) {
    return NextResponse.json({ error: "No database configured" }, { status: 503 });
  }

  let body: { statId?: string; decision?: string; reviewer?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { statId, decision, reviewer, note } = body;
  if (!statId || !reviewer) {
    return NextResponse.json({ error: "statId and reviewer are required" }, { status: 400 });
  }
  if (decision !== "approve" && decision !== "reject") {
    return NextResponse.json({ error: "decision must be 'approve' or 'reject'" }, { status: 400 });
  }

  const status = decision === "approve" ? "approved" : "rejected";
  const updated = await sql`
    UPDATE profitability_stats
    SET status = ${status},
        reviewed_by = ${reviewer},
        review_note = ${note ?? null},
        reviewed_at = now(),
        updated_at = now()
    WHERE id = ${statId} AND status = 'pending'
    RETURNING id, status
  `;

  if (updated.length === 0) {
    return NextResponse.json(
      { error: "No pending statistic with that id. Already reviewed records are immutable." },
      { status: 404 },
    );
  }

  clearPlatformCache();
  return NextResponse.json({ id: updated[0].id, status: updated[0].status });
}
