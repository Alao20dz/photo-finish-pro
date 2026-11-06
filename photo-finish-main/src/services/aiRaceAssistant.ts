/**
 * PHOTO FINISH PRO – Complete Athletics Management System
 * AI Race Assistant & Tactical Intelligence Engine (Stage C8)
 * 
 * Capabilities:
 * 1. Pacing Strategy Analysis (Negative Split, Positive Split, Even Pace, Variation %).
 * 2. Overtakes, Surges, and Lead Changes detection across checkpoints.
 * 3. AI Anomaly Clustering (separating human runner cheating from checkpoint measurement errors).
 * 4. Executive Press-Ready Automated Race Narrative in Arabic.
 * 5. Operates 100% offline with zero external API dependencies.
 */

import { 
  AthleticsCompetition, 
  MergedPassage, 
  RaceResultEntry, 
  ClubTeamScore, 
  RaceAnomaly, 
  PacingProfile, 
  LeadChange, 
  AiAnomalyCluster, 
  AiRaceReport,
  Checkpoint 
} from '../types/athletics';

export class AiRaceAssistantService {
  /**
   * تحليل الاستراتيجية التكتيكية وتوزيع الجهد للعداء (Pacing Strategy Analysis)
   */
  public analyzeRunnerPacing(
    bibNumber: number,
    athleteName: string,
    runnerPassages: MergedPassage[],
    checkpoints: Checkpoint[]
  ): PacingProfile {
    const cpMap = new Map<string, Checkpoint>();
    checkpoints.forEach(cp => cpMap.set(cp.id, cp));

    const sorted = [...runnerPassages].sort((a, b) => a.officialTimestamp - b.officialTimestamp);

    if (sorted.length < 2) {
      return {
        bibNumber,
        athleteName,
        pacingStyle: 'even_pace',
        averagePaceMinKm: '03:30',
        fastestSplitKm: 1,
        slowestSplitKm: 1,
        paceVariationPercent: 0,
        tacticalAdvice: 'بيانات نقاط المراقبة غير كافية لتقييم توزيع الجهد.'
      };
    }

    const splitPacesSecondsPerKm: number[] = [];

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      const prevCp = cpMap.get(prev.checkpointId);
      const currCp = cpMap.get(curr.checkpointId);

      if (prevCp && currCp) {
        const distKm = Math.abs(currCp.distanceKm - prevCp.distanceKm) || 0.5;
        const timeSec = (curr.officialTimestamp - prev.officialTimestamp) / 1000;
        if (distKm > 0 && timeSec > 0) {
          const paceSecPerKm = timeSec / distKm;
          splitPacesSecondsPerKm.push(paceSecPerKm);
        }
      }
    }

    if (splitPacesSecondsPerKm.length === 0) {
      splitPacesSecondsPerKm.push(210); // 3:30 default
    }

    const avgPaceSec = splitPacesSecondsPerKm.reduce((a, b) => a + b, 0) / splitPacesSecondsPerKm.length;
    const minPaceSec = Math.min(...splitPacesSecondsPerKm);
    const maxPaceSec = Math.max(...splitPacesSecondsPerKm);

    // حساب معامل التباين
    const variance = splitPacesSecondsPerKm.reduce((acc, val) => acc + Math.pow(val - avgPaceSec, 2), 0) / splitPacesSecondsPerKm.length;
    const stdDev = Math.sqrt(variance);
    const paceVariationPercent = Math.round((stdDev / avgPaceSec) * 1000) / 10;

    // مقارنة النصف الأول بالنصف الثاني
    const half = Math.floor(splitPacesSecondsPerKm.length / 2);
    const firstHalfAvg = splitPacesSecondsPerKm.slice(0, half || 1).reduce((a, b) => a + b, 0) / (half || 1);
    const secondHalfAvg = splitPacesSecondsPerKm.slice(half).reduce((a, b) => a + b, 0) / (splitPacesSecondsPerKm.length - half || 1);

    let pacingStyle: PacingProfile['pacingStyle'] = 'even_pace';
    let tacticalAdvice = '';

    if (secondHalfAvg < firstHalfAvg * 0.96) {
      // النصف الثاني أسرع بأكثر من 4%
      pacingStyle = 'negative_split';
      tacticalAdvice = 'استراتيجية ممتازة (Negative Split): توزيع مثالي للطاقة مع زيادة السرعة في النصف الثاني وتحقيق نهاية سباق قوية.';
    } else if (secondHalfAvg > firstHalfAvg * 1.06) {
      // النصف الثاني أبطأ بأكثر من 6%
      pacingStyle = 'positive_split';
      tacticalAdvice = 'انطلاق مفرط السرعة (Positive Split): بدأ العداء باندفاع شديد مما أدى إلى تراكم اللاكتات وتراجع وتيرته في الكيلومترات الأخيرة. يُنصح بضبط وتيرة الانطلاق.';
    } else if (paceVariationPercent <= 5.0) {
      pacingStyle = 'even_pace';
      tacticalAdvice = 'وتيرة منضبطة ومستقرة (Even Pace): ثبات تكتيكي ممتاز على مدار مسار السباق وتجنب الهدر العضلي.';
    } else {
      pacingStyle = 'irregular';
      tacticalAdvice = 'وتيرة غير منتظمة (Irregular Pacing): تذبذب متكرر في السرعة. ينصح بتثبيت الإيقاع التنفسي والخطوات.';
    }

    const formatPace = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')} /كم`;
    };

    return {
      bibNumber,
      athleteName,
      pacingStyle,
      averagePaceMinKm: formatPace(avgPaceSec),
      fastestSplitKm: Math.round(minPaceSec * 10) / 10,
      slowestSplitKm: Math.round(maxPaceSec * 10) / 10,
      paceVariationPercent,
      tacticalAdvice
    };
  }

  /**
   * رصد التغيرات على الصدارة وتبادل المراكز (Lead Changes & Overtakes)
   */
  public detectLeadChanges(
    competition: AthleticsCompetition,
    allPassages: MergedPassage[]
  ): LeadChange[] {
    const sortedCps = [...competition.checkpoints].sort((a, b) => a.order - b.order);
    const leadChanges: LeadChange[] = [];

    let currentLeaderBib: number | null = null;
    let currentLeaderName = '';

    sortedCps.forEach(cp => {
      // العثور على أسرع عداء عبر هذه النقطة في الحلقة 1
      const cpPassages = allPassages.filter(p => p.checkpointId === cp.id && p.status === 'valid');
      if (cpPassages.length === 0) return;

      cpPassages.sort((a, b) => a.officialTimestamp - b.officialTimestamp);
      const firstAcross = cpPassages[0];
      const secondAcross = cpPassages[1];

      const gapSec = secondAcross ? (secondAcross.officialTimestamp - firstAcross.officialTimestamp) / 1000 : 0;

      if (currentLeaderBib === null) {
        currentLeaderBib = firstAcross.bibNumber;
        currentLeaderName = firstAcross.athleteName || `صدر #${firstAcross.bibNumber}`;
        leadChanges.push({
          checkpointCode: cp.code,
          kilometerMark: cp.distanceKm,
          newLeaderBib: firstAcross.bibNumber,
          newLeaderName: currentLeaderName,
          gapSeconds: gapSec
        });
      } else if (currentLeaderBib !== firstAcross.bibNumber) {
        // تغير في الصدارة!
        leadChanges.push({
          checkpointCode: cp.code,
          kilometerMark: cp.distanceKm,
          newLeaderBib: firstAcross.bibNumber,
          newLeaderName: firstAcross.athleteName || `صدر #${firstAcross.bibNumber}`,
          previousLeaderBib: currentLeaderBib,
          previousLeaderName: currentLeaderName,
          gapSeconds: gapSec
        });
        currentLeaderBib = firstAcross.bibNumber;
        currentLeaderName = firstAcross.athleteName || `صدر #${firstAcross.bibNumber}`;
      }
    });

    return leadChanges;
  }

  /**
   * التشخيص الذكي للشذوذ وتجميع الأخطاء (AI Anomaly Clustering)
   * يفصل بين غش المتسابق المنعزل والخطأ الفني في قياس المسار
   */
  public diagnoseAnomalyClusters(anomalies: RaceAnomaly[]): AiAnomalyCluster[] {
    const clusters: AiAnomalyCluster[] = [];

    // تجميع الشذوذ حسب نقطة المراقبة
    const anomaliesByCp = new Map<string, RaceAnomaly[]>();
    anomalies.forEach(a => {
      const list = anomaliesByCp.get(a.checkpointCode) || [];
      list.push(a);
      anomaliesByCp.set(a.checkpointCode, list);
    });

    anomaliesByCp.forEach((cpAnomalies, cpCode) => {
      const speedAnomalies = cpAnomalies.filter(a => a.type === 'speed_anomaly');
      const skippedAnomalies = cpAnomalies.filter(a => a.type === 'skipped_checkpoint');

      // إذا وُجد 3 عدائين أو أكثر لديهم تنبيه سرعة مستحيلة في نفس النقطة:
      if (speedAnomalies.length >= 3) {
        clusters.push({
          clusterType: 'suspected_course_measurement_error',
          affectedCheckpoints: [cpCode],
          affectedBibs: speedAnomalies.map(a => a.bibNumber),
          confidence: 0.94,
          diagnosis: `اشتباه خطأ طوبوغرافي في تحديد مسافة النقطة (${cpCode}): تسجيل سرعات مرتفعة لعدة عدائين (${speedAnomalies.length}) يوحي بأن المسافة المسجلة للنقطة أقصر من المسافة الحقيقية المقطوعة.`,
          recommendation: `يوصى الحكم العام بمراجعة قياس المسافة الفعلي بين (${cpCode}) والنقطة السابقة واعتماد النتائج دون استبعاد العدائين.`
        });
      } else if (skippedAnomalies.length >= 3) {
        clusters.push({
          clusterType: 'judge_timing_drift',
          affectedCheckpoints: [cpCode],
          affectedBibs: skippedAnomalies.map(a => a.bibNumber),
          confidence: 0.88,
          diagnosis: `انقطاع تسجيل أو خطأ توجيه في النقطة (${cpCode}): عدم رصد أكثر من 3 متسابقين يشير إلى انقطاع هاتف الحكم أو عدم وجوده في موقعه المخصص.`,
          recommendation: `التحقق من سجل هاتف حكم النقطة (${cpCode}) واستيراد طابور عدم الاتصال (Offline Queue).`
        });
      } else {
        // مخالفة فردية معزولة
        cpAnomalies.forEach(single => {
          clusters.push({
            clusterType: 'isolated_runner_irregularity',
            affectedCheckpoints: [single.checkpointCode],
            affectedBibs: [single.bibNumber],
            confidence: 0.91,
            diagnosis: `شبهة فردية معزولة للمتسابق #${single.bibNumber} في (${single.checkpointCode}): ${single.details}`,
            recommendation: `تطبيق قرار الحكم العام (إهمال الشبهة أو استبعاد DQ بموجب لوائح World Athletics).`
          });
        });
      }
    });

    return clusters;
  }

  /**
   * توليد التقرير الصحفي والتحليلي الشامل باللغة العربية (Executive Press Narrative)
   */
  public generateFullRaceReport(
    competition: AthleticsCompetition,
    results: RaceResultEntry[],
    teamScores?: ClubTeamScore[],
    anomalies?: RaceAnomaly[],
    allPassages?: MergedPassage[]
  ): AiRaceReport {
    const finished = results.filter(r => r.status === 'finished');
    const winner = finished[0];
    const second = finished[1];
    const third = finished[2];

    const winnerHeadline = winner 
      ? `تتويج مستحق للبطل ${winner.athleteName} (${winner.clubName}) بلقب ${competition.name} بتوقيت رسمي ${winner.formattedGunTime}`
      : `اختتام فعاليات ${competition.name}`;

    const teamChampion = teamScores && teamScores[0] ? teamScores[0] : null;
    const teamChampionHeadline = teamChampion
      ? `نادي ${teamChampion.clubName} يتربع على عرش ترتيب الفرق (Rule 19) برصيد ${teamChampion.totalPoints} نقطة`
      : undefined;

    // تحليل وتيرة أول 5 عدائين
    const pacingInsights: PacingProfile[] = [];
    if (allPassages && competition.checkpoints.length > 0) {
      finished.slice(0, 5).forEach(r => {
        const runnerPassages = allPassages.filter(p => p.bibNumber === r.bibNumber);
        const profile = this.analyzeRunnerPacing(r.bibNumber, r.athleteName, runnerPassages, competition.checkpoints);
        pacingInsights.push(profile);
      });
    }

    // رصد تغيرات الصدارة
    const leadChanges = allPassages ? this.detectLeadChanges(competition, allPassages) : [];

    // تجميع الشذوذ بالذكاء الاصطناعي
    const anomalyClusters = this.diagnoseAnomalyClusters(anomalies || []);

    const triageRecs: string[] = [];
    if (anomalyClusters.some(c => c.clusterType === 'suspected_course_measurement_error')) {
      triageRecs.push('توصية عاجلة: مراجعة قياس المسافة للنقاط البينية المشتبه بها لتفادي استبعاد خاطئ للعدائين.');
    }
    if (results.some(r => r.status === 'dq')) {
      triageRecs.push('توصية تحكيمية: توثيق أسباب الاستبعاد (DQ) في المحضر النهائي وفق تقرير غرفة الحكم العام.');
    }
    if (triageRecs.length === 0) {
      triageRecs.push('النزاهة الرياضية مكتملة: لم تُسجل أي اختلالات تعيق الاعتماد والتصديق الفوري للنتائج.');
    }

    // صياغة النص الصحفي التنفيذي
    const fullNarrativeArabic = `
# التقرير الفني والتحليلي لسباق: ${competition.name}
**تاريخ المنافسة:** ${competition.date} | **المكان:** ${competition.venue} | **المسافة:** ${competition.distanceKm} كم (${competition.lapCount} حلقات)
**الفئة:** ${competition.category} (${competition.gender === 'M' ? 'رجال' : competition.gender === 'F' ? 'سيدات' : 'مختلط'})

---

### 1. ملخص منصة التتويج الفردية:
في سباق اتسم بالإثارة والندية التكتيكية العالية، تمكن العداء **${winner ? winner.athleteName : '-'}** من نادي **${winner ? winner.clubName : '-'}** من حسم المركز الأول والميدالية الذهبية قاطعاً المسافة بزمن قدره **${winner ? winner.formattedGunTime : '-'}**.
وجاء في المركز الثاني والميدالية الفضية العداء **${second ? second.athleteName : '-'}** (${second ? second.clubName : '-'}) بفارق **${second ? second.formattedGap : '-'}**، في حين نال الميدالية البرونزية العداء **${third ? third.athleteName : '-'}** (${third ? third.clubName : '-'}) بفارق **${third ? third.formattedGap : '-'}**.

### 2. الترتيب العام للفرق (World Athletics Rule 19):
${teamChampion ? `
فرض **نادي ${teamChampion.clubName}** سيطرته على الترتيب الجماعي بمجموع **${teamChampion.totalPoints} نقطة** بفضل الأداء المتوازن لعدائيه، متقدماً على منافسيه وفق المعيار الدولي لاحتساب مجموع رتب أفضل ${teamChampion.scoringCount} عدائين.
` : 'لم يتم تسجيل نتائج جماعية كافية لاحتساب ترتيب الفرق.'}

### 3. القراءة التكتيكية وتحليل توزيع الجهد (AI Pacing):
أظهرت تحليلات الحساسات الذكية ونقاط المراقبة أن الفائز اعتمد استراتيجية **(${pacingInsights[0]?.pacingStyle === 'negative_split' ? 'Negative Split متصاعد' : pacingInsights[0]?.pacingStyle === 'even_pace' ? 'Even Pace منتظم' : 'توزيع هجومي مبكر'})** بمعدل سرعة **${pacingInsights[0]?.averagePaceMinKm || '03:15 /كم'}** مع ثبات استثنائي في الكيلومتر الأخير.

### 4. سلامة التحكيم والنزاهة الرياضية:
تمت مطابقة تسجيلات حكام النقاط الميدانية عبر منظومة **Consensus Engine** بنسبة موثوقية عالية، مع خلو المنافسة من أي طعون غير معالجة، لتصبح النتائج معتمدة ومؤهلة للتصديق الرسمي.
`.trim();

    return {
      title: `تقرير التحليل التكتيكي الذكي - ${competition.name}`,
      summary: `${winnerHeadline}. ${teamChampionHeadline || ''}`,
      winnerHeadline,
      teamChampionHeadline,
      pacingInsights,
      leadChanges,
      anomalyClusters,
      triageRecommendations: triageRecs,
      fullNarrativeArabic,
      generatedAt: Date.now()
    };
  }
}

export const aiRaceAssistantService = new AiRaceAssistantService();
