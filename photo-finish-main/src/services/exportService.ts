/**
 * PHOTO FINISH PRO – Complete Athletics Management System
 * Enterprise Results Exporter (PDF / Excel CSV / JSON) (Stage C7)
 * 
 * Features:
 * 1. Excel CSV with UTF-8 BOM (\uFEFF) for flawless Arabic rendering in Excel.
 * 2. World Athletics standard JSON schema.
 * 3. High-resolution print-ready HTML/PDF with official signature and stamp block.
 * 4. Zero external runtime dependencies.
 */

import { 
  AthleticsCompetition, 
  RaceResultEntry, 
  ClubTeamScore 
} from '../types/athletics';

export class ExportService {
  /**
   * تصدير النتائج إلى ملف CSV متوافق مع Excel والأبجدية العربية عبر UTF-8 BOM
   */
  public exportToCsv(
    competition: AthleticsCompetition, 
    results: RaceResultEntry[]
  ): string {
    const BOM = '\uFEFF';
    const headers = [
      'الترتيب',
      'رقم الصدر',
      'اسم العداء',
      'النادي',
      'الفئة',
      'الجنس',
      'زمن البندقية (Gun Time)',
      'الزمن الصافي (Net Time)',
      'الفارق عن الأول',
      'الحلقات',
      'الحالة الرسمية'
    ];

    const rows = results.map(r => [
      r.rank > 0 && r.rank < 1000 ? r.rank : '-',
      r.bibNumber,
      `"${r.athleteName.replace(/"/g, '""')}"`,
      `"${r.clubName.replace(/"/g, '""')}"`,
      r.category,
      r.gender === 'M' ? 'رجال' : r.gender === 'F' ? 'سيدات' : 'مختلط',
      r.formattedGunTime,
      r.formattedNetTime,
      r.formattedGap,
      r.completedLaps,
      r.status === 'finished' ? 'أنهى السباق' : r.status === 'dnf' ? 'انسحاب (DNF)' : r.status === 'dq' ? `استبعاد (DQ) - ${r.disqualificationReason || ''}` : 'غياب (DNS)'
    ]);

    const csvContent = [
      `"تقرير النتائج الرسمية - ${competition.name.replace(/"/g, '""')}"`,
      `"المكان: ${competition.venue.replace(/"/g, '""')} | التاريخ: ${competition.date} | المسافة: ${competition.distanceKm} كم"`,
      '',
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\r\n');

    return BOM + csvContent;
  }

  /**
   * تصدير النتائج بصيغة JSON القياسية للاتحادات وأنظمة العرض
   */
  public exportToJson(
    competition: AthleticsCompetition, 
    results: RaceResultEntry[],
    teamStandings?: ClubTeamScore[]
  ): string {
    const payload = {
      version: 'PHOTO_FINISH_PRO_AI_2026',
      competition: {
        id: competition.id,
        name: competition.name,
        type: competition.type,
        venue: competition.venue,
        date: competition.date,
        distanceKm: competition.distanceKm,
        lapCount: competition.lapCount,
        category: competition.category,
        gender: competition.gender,
        chiefJudgeName: competition.chiefJudgeName || 'الحكم العام'
      },
      results: results.map(r => ({
        rank: r.rank,
        bibNumber: r.bibNumber,
        athleteName: r.athleteName,
        clubName: r.clubName,
        category: r.category,
        gender: r.gender,
        gunTimeMs: r.gunTimeMs,
        netTimeMs: r.netTimeMs,
        formattedGunTime: r.formattedGunTime,
        formattedNetTime: r.formattedNetTime,
        gapMs: r.gapMs,
        formattedGap: r.formattedGap,
        completedLaps: r.completedLaps,
        status: r.status,
        disqualificationReason: r.disqualificationReason
      })),
      teamStandings: teamStandings || [],
      exportedAt: new Date().toISOString()
    };

    return JSON.stringify(payload, null, 2);
  }

  /**
   * إنشاء استمارة النتائج الرسمية بصيغة HTML مجهزة للطباعة والحفظ كـ PDF عالي الجودة
   */
  public generatePrintableHtml(
    competition: AthleticsCompetition,
    results: RaceResultEntry[],
    teamScores?: ClubTeamScore[]
  ): string {
    const finishResults = results.filter(r => r.status === 'finished');
    const dnfResults = results.filter(r => r.status === 'dnf');
    const dqResults = results.filter(r => r.status === 'dq');
    const dnsResults = results.filter(r => r.status === 'dns');

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>النتائج الرسمية - ${competition.name}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 12mm 15mm 12mm;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 11pt;
      line-height: 1.4;
    }
    .header {
      border-bottom: 3px double #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header-titles {
      text-align: right;
    }
    .header h1 {
      margin: 0 0 4px 0;
      font-size: 18pt;
      color: #0f172a;
    }
    .header p {
      margin: 0;
      font-size: 10pt;
      color: #475569;
    }
    .badge-official {
      background: #0f172a;
      color: #ffffff;
      font-weight: bold;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 10pt;
      text-transform: uppercase;
    }
    .meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 16px;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      font-size: 9.5pt;
    }
    .meta-item strong {
      display: block;
      color: #64748b;
      font-size: 8.5pt;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 9.5pt;
    }
    th {
      background: #f1f5f9;
      color: #1e293b;
      font-weight: bold;
      text-align: right;
      padding: 6px 8px;
      border-bottom: 2px solid #cbd5e1;
    }
    td {
      padding: 5px 8px;
      border-bottom: 1px solid #e2e8f0;
    }
    tr:nth-child(even) td {
      background: #fafafa;
    }
    .font-mono {
      font-family: Consolas, monospace;
    }
    .rank-col {
      font-weight: bold;
      width: 45px;
    }
    .bib-col {
      font-weight: bold;
      width: 55px;
    }
    .time-col {
      font-weight: bold;
      color: #0f172a;
      width: 95px;
    }
    .gap-col {
      color: #64748b;
      width: 85px;
    }
    .section-title {
      font-size: 12pt;
      font-weight: bold;
      margin: 16px 0 8px 0;
      border-right: 4px solid #0f172a;
      padding-right: 8px;
    }
    .signatures-block {
      margin-top: 35px;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 20px;
      text-align: center;
      page-break-inside: avoid;
    }
    .signature-box {
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 15px 10px 35px 10px;
      font-size: 9pt;
      color: #475569;
    }
    .signature-box strong {
      display: block;
      margin-bottom: 6px;
      color: #0f172a;
    }
    .footer {
      margin-top: 25px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      font-size: 8pt;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-titles">
      <h1>${competition.name}</h1>
      <p>محضر النتائج الرسمية • معتمد وفق لوائح الاتحاد الدولي لألعاب القوى (World Athletics)</p>
      <p style="font-size: 8.5pt; color: #64748b;">Procès-verbal officiel des résultats • Conforme aux règlements World Athletics</p>
    </div>
    <div class="badge-official">
      نتائج رسمية نهائية<br>
      <span style="font-size: 7.5pt;">Résultats officiels définitifs</span>
    </div>
  </div>

  <div class="meta-box">
    <div class="meta-item">
      <strong>المكان والمضمار / Lieu :</strong>
      <span>${competition.venue}</span>
    </div>
    <div class="meta-item">
      <strong>تاريخ السباق / Date :</strong>
      <span>${competition.date}</span>
    </div>
    <div class="meta-item">
      <strong>المسافة والحلقات / Distance :</strong>
      <span>${competition.distanceKm} كم (${competition.lapCount} حلقات / tours)</span>
    </div>
    <div class="meta-item">
      <strong>الفئة والجنس / Catégorie :</strong>
      <span>${competition.category} • ${competition.gender === 'M' ? 'رجال / Hommes' : competition.gender === 'F' ? 'سيدات / Femmes' : 'مختلط / Mixte'}</span>
    </div>
  </div>

  <div class="section-title">أولاً: الترتيب الفردي العام — Individual Classification</div>
  <table>
    <thead>
      <tr>
        <th class="rank-col">الرتبة<br><span style="font-size:7pt;font-weight:normal;">Rang</span></th>
        <th class="bib-col">الصدر<br><span style="font-size:7pt;font-weight:normal;">Dossard</span></th>
        <th>اسم العداء واللقب<br><span style="font-size:7pt;font-weight:normal;">Nom de l'athlète</span></th>
        <th>النادي أو الفريق<br><span style="font-size:7pt;font-weight:normal;">Club / Équipe</span></th>
        <th class="time-col">زمن البندقية<br><span style="font-size:7pt;font-weight:normal;">Temps gun</span></th>
        <th class="time-col">الزمن الصافي<br><span style="font-size:7pt;font-weight:normal;">Temps net</span></th>
        <th class="gap-col">الفارق<br><span style="font-size:7pt;font-weight:normal;">Écart</span></th>
      </tr>
    </thead>
    <tbody>
      ${finishResults.map(r => `
        <tr>
          <td class="rank-col font-mono">${r.rank}</td>
          <td class="bib-col font-mono">${r.bibNumber}</td>
          <td><strong>${r.athleteName}</strong></td>
          <td>${r.clubName}</td>
          <td class="time-col font-mono">${r.formattedGunTime}</td>
          <td class="time-col font-mono">${r.formattedNetTime}</td>
          <td class="gap-col font-mono">${r.formattedGap}</td>
        </tr>
      `).join('')}
      ${dnfResults.map(r => `
        <tr style="color: #64748b;">
          <td class="rank-col">-</td>
          <td class="bib-col font-mono">${r.bibNumber}</td>
          <td>${r.athleteName}</td>
          <td>${r.clubName}</td>
          <td colspan="3"><strong>انسحاب أثناء السباق (DNF)</strong></td>
        </tr>
      `).join('')}
      ${dqResults.map(r => `
        <tr style="color: #b91c1c;">
          <td class="rank-col">DQ</td>
          <td class="bib-col font-mono">${r.bibNumber}</td>
          <td>${r.athleteName}</td>
          <td>${r.clubName}</td>
          <td colspan="3"><strong>استبعاد رسمي (DQ): ${r.disqualificationReason || 'مخالفة'}</strong></td>
        </tr>
      `).join('')}
      ${dnsResults.map(r => `
        <tr style="color: #94a3b8;">
          <td class="rank-col">-</td>
          <td class="bib-col font-mono">${r.bibNumber}</td>
          <td>${r.athleteName}</td>
          <td>${r.clubName}</td>
          <td colspan="3">لم يبدأ السباق (DNS)</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  ${teamScores && teamScores.length > 0 ? `
    <div class="section-title">ثانياً: ترتيب الفرق والأندية — Classement des équipes (Règle 19 World Athletics)</div>
    <table>
      <thead>
        <tr>
          <th class="rank-col">الرتبة</th>
          <th>النادي / الفريق</th>
          <th style="width: 100px;">مجموع النقاط</th>
          <th>العداؤون المحتسبون (الصدر - الرتبة)</th>
          <th style="width: 120px;">العداء الحاسم</th>
        </tr>
      </thead>
      <tbody>
        ${teamScores.map(t => `
          <tr>
            <td class="rank-col font-mono">${t.rank}</td>
            <td><strong>${t.clubName}</strong></td>
            <td class="font-mono"><strong>${t.totalPoints} نقطة</strong></td>
            <td>${t.runners.filter(r => r.isScorer).map(r => `#${r.bibNumber} (${r.individualRank})`).join(' + ')}</td>
            <td class="font-mono">رتبة #${t.lastScorerRank}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''}

  <div class="signatures-block">
    <div class="signature-box">
      <strong>أمانة أجهزة التوقيت</strong>
      <span>نظام Photo Finish Pro AI</span>
    </div>
    <div class="signature-box">
      <strong>رئيس حكام خط النهاية</strong>
      <span>التوقيع والتأشيرة</span>
    </div>
    <div class="signature-box">
      <strong>الحكم العام للسباق (Chief Judge)</strong>
      <span>${competition.chiefJudgeName || 'الحكم العام'}</span>
    </div>
  </div>

  <div class="footer">
    <span>نظام Photo Finish Pro AI • منصة إدارة ألعاب القوى والتوقيت الرياضي</span>
    <span>تاريخ التوليد: ${new Date().toLocaleString('ar-DZ')}</span>
  </div>
</body>
</html>`;

    return html;
  }

  /**
   * تحميل وتنزيل الملف في المتصفح محلياً
   */
  public downloadFile(content: string, filename: string, mimeType: string): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * فتح نافذة الطباعة الرسمية للنتائج كـ PDF
   */
  public printResults(
    competition: AthleticsCompetition, 
    results: RaceResultEntry[],
    teamScores?: ClubTeamScore[]
  ): void {
    if (typeof window === 'undefined') return;

    const printHtml = this.generatePrintableHtml(competition, results, teamScores);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(printHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  }
}

export const exportService = new ExportService();
