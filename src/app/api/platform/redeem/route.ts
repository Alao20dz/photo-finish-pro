import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";

/**
 * استبدال كود وضع المنافسة (Redeem) — نظير مبسّط لـ Edge Function redeem-code
 * الإنتاج: تتحقق من Supabase Auth Anonymous ثم تنشئ code_sessions.
 * هنا: تحقق من التجزئة + الإبطال + الانتهاء + حد الاستخدام + تحديد المعدل.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = attempts.get(ip) || { count: 0, resetAt: now + 60_000 };
  if (now > rec.resetAt) { rec.count = 0; rec.resetAt = now + 60_000; }
  rec.count++;
  attempts.set(ip, rec);
  return rec.count > 10;
}

const sha = (s: string) => createHash("sha256").update(s.trim().toUpperCase()).digest("hex");

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (rateLimited(ip)) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  let body: { code?: string; deviceId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const code = String(body.code || "").trim().toUpperCase();
  const deviceId = String(body.deviceId || "").slice(0, 64) || "unknown-device";
  if (!code || code.length < 6) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const record = await db.competitionCode.findUnique({
    where: { codeHash: sha(code) },
    include: {
      competition: { include: { league: true } },
    },
  });

  if (!record || record.revoked || record.expiresAt.getTime() < Date.now() || record.uses >= record.maxUses) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 401 });
  }

  // جلسة الكود: تربط الجهاز بالمهمة (نظير code_sessions في Supabase)
  const session = await db.codeSession.create({
    data: { codeId: record.id, deviceId, authUserId: null },
  });
  await db.competitionCode.update({ where: { id: record.id }, data: { uses: { increment: 1 } } });
  await db.auditLog.create({
    data: {
      actor: deviceId,
      action: "CODE_REDEEM",
      entity: "competition_code",
      entityId: record.id,
      reason: `استبدال كود ${record.codeMasked}`,
      ip,
    },
  });

  return NextResponse.json({
    ok: true,
    session: session.id,
    task: {
      role: record.role,
      league: { nameAr: record.competition.league.nameAr, code: record.competition.league.code },
      competition: {
        id: record.competition.id,
        titleAr: record.competition.titleAr,
        venue: record.competition.venue,
        startDate: record.competition.startDate,
      },
      station: record.assignedTo,
      note: record.note,
      masked: record.codeMasked,
      checkedInAt: session.createdAt.toISOString(),
      remainingUses: Math.max(0, record.maxUses - record.uses - 1),
    },
  });
}
