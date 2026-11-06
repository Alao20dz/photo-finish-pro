import { Athlete, AthleteDuplicateMatch } from '../types/athletics';

export class AthleteDeduplicationService {
  /**
   * تطبيع النصوص العربية وإزالة التشكيل وتوحيد الألف والياء والتاء المربوطة
   */
  public static normalizeArabic(text: string): string {
    if (!text) return '';
    return text
      .trim()
      .toLowerCase()
      // إزالة التشكيل
      .replace(/[\u064B-\u065F\u0670]/g, '')
      // توحيد الألف
      .replace(/[إأآا]/g, 'ا')
      // توحيد الياء
      .replace(/[يى]/g, 'ي')
      // توحيد التاء المربوطة
      .replace(/ة/g, 'ه')
      // إزالة علامات الترقيم والمسافات الزائدة
      .replace(/[-_.,]/g, ' ')
      .replace(/\s+/g, ' ');
  }

  /**
   * تطبيع النصوص اللاتينية وإزالة النبرات الصوتية (Accents)
   */
  public static normalizeLatin(text: string): string {
    if (!text) return '';
    return text
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[-_.,]/g, ' ')
      .replace(/\s+/g, ' ');
  }

  /**
   * حساب تشابه النصوص (خوارزمية Levenshtein Similarity) من 0.0 إلى 1.0
   */
  public static calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.trim().toLowerCase();
    const s2 = str2.trim().toLowerCase();

    if (s1 === s2) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0.0;

    const track = Array(s2.length + 1)
      .fill(null)
      .map(() => Array(s1.length + 1).fill(null));

    for (let i = 0; i <= s1.length; i += 1) {
      track[0][i] = i;
    }
    for (let j = 0; j <= s2.length; j += 1) {
      track[j][0] = j;
    }

    for (let j = 1; j <= s2.length; j += 1) {
      for (let i = 1; i <= s1.length; i += 1) {
        const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j][i - 1] + 1, // deletion
          track[j - 1][i] + 1, // insertion
          track[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    const distance = track[s2.length][s1.length];
    const maxLength = Math.max(s1.length, s2.length);
    return Math.max(0, 1 - distance / maxLength);
  }

  /**
   * فحص عداء جديد أو معدل مقابل قاعدة العدائين القائمة لكشف أي تكرار أو تعارض
   * @param candidate العداء المراد تسجيله
   * @param existingAthletes قائمة العدائين المسجلين في النظام
   */
  public static findDuplicates(
    candidate: Partial<Athlete>,
    existingAthletes: Athlete[]
  ): AthleteDuplicateMatch[] {
    const matches: AthleteDuplicateMatch[] = [];

    const normCandFirstAr = this.normalizeArabic(candidate.firstName || '');
    const normCandLastAr = this.normalizeArabic(candidate.lastName || '');
    const normCandFullAr = `${normCandFirstAr} ${normCandLastAr}`.trim();

    const normCandFirstLt = this.normalizeLatin(candidate.firstName || '');
    const normCandLastLt = this.normalizeLatin(candidate.lastName || '');
    const normCandFullLt = `${normCandFirstLt} ${normCandLastLt}`.trim();

    const candYear = candidate.birthDate ? candidate.birthDate.split('-')[0] : null;
    const cleanCandLicense = candidate.licenseNumber?.trim().toUpperCase().replace(/[\s-]/g, '');

    for (const existing of existingAthletes) {
      // تجنب مطابقة العداء مع نفسه في حالة التعديل
      if (candidate.id && candidate.id === existing.id) {
        continue;
      }

      const cleanExistLicense = existing.licenseNumber?.trim().toUpperCase().replace(/[\s-]/g, '');
      const existYear = existing.birthDate ? existing.birthDate.split('-')[0] : null;

      // 1. تطابق قطعي في رقم الرخصة الاتحادية (Exact License Match)
      if (cleanCandLicense && cleanExistLicense && cleanCandLicense === cleanExistLicense) {
        matches.push({
          existingAthlete: existing,
          matchType: 'exact_license',
          similarityScore: 1.0,
          conflictDetails: `تطابق تام في رقم رخصة الاتحاد (${existing.licenseNumber}) مع العداء (${existing.firstName} ${existing.lastName}) المسجل في (${existing.clubName || 'نادي آخر'}).`,
          recommendedAction: 'block',
        });
        continue;
      }

      // 2. تطابق الاسم وسنة الميلاد (Name and Birth Year Match)
      const normExistFirstAr = this.normalizeArabic(existing.firstName);
      const normExistLastAr = this.normalizeArabic(existing.lastName);
      const normExistFullAr = `${normExistFirstAr} ${normExistLastAr}`.trim();

      const normExistFirstLt = this.normalizeLatin(existing.firstName);
      const normExistLastLt = this.normalizeLatin(existing.lastName);
      const normExistFullLt = `${normExistFirstLt} ${normExistLastLt}`.trim();

      const sameYear = candYear && existYear && candYear === existYear;

      const simAr = normCandFullAr && normExistFullAr
        ? this.calculateSimilarity(normCandFullAr, normExistFullAr)
        : 0;

      const simLt = normCandFullLt && normExistFullLt
        ? this.calculateSimilarity(normCandFullLt, normExistFullLt)
        : 0;

      const maxSim = Math.max(simAr, simLt);

      if (maxSim >= 0.92 && sameYear) {
        matches.push({
          existingAthlete: existing,
          matchType: 'name_and_birthyear',
          similarityScore: maxSim,
          conflictDetails: `تطابق بنسبة ${(maxSim * 100).toFixed(0)}% في الاسم وتطابق في سنة الميلاد (${candYear}) مع العداء (${existing.firstName} ${existing.lastName}).`,
          recommendedAction: 'block',
        });
        continue;
      }

      // 3. تشابه تقريبي في الاسم (Fuzzy Name Match) مع نفس النادي أو الجنس
      if (maxSim >= 0.85) {
        const isSameClub = candidate.clubId && existing.clubId && candidate.clubId === existing.clubId;
        matches.push({
          existingAthlete: existing,
          matchType: 'fuzzy_name',
          similarityScore: maxSim,
          conflictDetails: `اشتباه تشابه اسم بنسبة ${(maxSim * 100).toFixed(0)}% مع (${existing.firstName} ${existing.lastName}) ${isSameClub ? 'في نفس النادي' : ''}.`,
          recommendedAction: 'warn',
        });
      }

      // 4. تكرار رقم الصدرية (Bib) داخل نفس النادي
      if (
        candidate.bibNumber &&
        existing.bibNumber &&
        candidate.bibNumber === existing.bibNumber &&
        candidate.clubId &&
        existing.clubId &&
        candidate.clubId === existing.clubId
      ) {
        matches.push({
          existingAthlete: existing,
          matchType: 'same_bib_in_club',
          similarityScore: 0.9,
          conflictDetails: `رقم الصدرية #${candidate.bibNumber} مخصص مسبقاً للعداء (${existing.firstName} ${existing.lastName}) في نادي (${existing.clubName}).`,
          recommendedAction: 'warn',
        });
      }
    }

    // فرز النتائج بحيث تأتي أشد حالات التعارض أولاً
    return matches.sort((a, b) => b.similarityScore - a.similarityScore);
  }
}
