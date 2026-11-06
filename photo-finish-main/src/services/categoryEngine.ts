import { AgeCategory, CategoryRule, CategorySnapshot, Athlete } from '../types/athletics';

export const CATEGORY_NAMES_AR: Record<AgeCategory, string> = {
  U14: 'براعم (U14)',
  U16: 'أصاغر (U16)',
  U18: 'أشبال (U18)',
  U20: 'أواسط (U20)',
  SENIOR: 'أكابر (Senior)',
  MASTER: 'قدماء (Master)',
  OPEN: 'مفتوح (Open)',
};

export class CategoryEngine {
  /**
   * حساب الفئة العمرية المعتمدة رسمياً حسب الاتحاد الدولي لألعاب القوى (World Athletics)
   * الفئة تُحسب وفق سنة ميلاد المتسابق مقارنة بسنة المنافسة:
   * Age = ReferenceYear - BirthYear
   * 
   * - أقل من 14 سنة: U14 (براعم)
   * - 14 و 15 سنة: U16 (أصاغر)
   * - 16 و 17 سنة: U18 (أشبال)
   * - 18 و 19 سنة: U20 (أواسط)
   * - من 20 إلى 34 سنة: SENIOR (أكابر)
   * - 35 سنة فأكثر: MASTER (قدماء/ماسترز)
   */
  public static calculateCategory(
    birthDateStr: string,
    referenceYear: number = new Date().getFullYear()
  ): { category: AgeCategory; age: number; categoryNameAr: string } {
    if (!birthDateStr) {
      return { category: 'OPEN', age: 0, categoryNameAr: CATEGORY_NAMES_AR.OPEN };
    }

    const birthYear = parseInt(birthDateStr.split('-')[0], 10);
    if (isNaN(birthYear) || birthYear < 1920 || birthYear > referenceYear) {
      return { category: 'OPEN', age: 0, categoryNameAr: CATEGORY_NAMES_AR.OPEN };
    }

    const age = referenceYear - birthYear;

    let category: AgeCategory;
    if (age < 14) {
      category = 'U14';
    } else if (age <= 15) {
      category = 'U16';
    } else if (age <= 17) {
      category = 'U18';
    } else if (age <= 19) {
      category = 'U20';
    } else if (age <= 34) {
      category = 'SENIOR';
    } else {
      category = 'MASTER';
    }

    return {
      category,
      age,
      categoryNameAr: CATEGORY_NAMES_AR[category] || category,
    };
  }

  /**
   * استخراج جدول القواعد والفترات السنوية لموسم أو سنة مرجعية معينة
   */
  public static getCategoryRules(referenceYear: number = new Date().getFullYear()): CategoryRule[] {
    return [
      {
        category: 'U14',
        nameAr: CATEGORY_NAMES_AR.U14,
        minAge: 0,
        maxAge: 13,
        birthYearRange: { from: referenceYear - 13, to: referenceYear },
      },
      {
        category: 'U16',
        nameAr: CATEGORY_NAMES_AR.U16,
        minAge: 14,
        maxAge: 15,
        birthYearRange: { from: referenceYear - 15, to: referenceYear - 14 },
      },
      {
        category: 'U18',
        nameAr: CATEGORY_NAMES_AR.U18,
        minAge: 16,
        maxAge: 17,
        birthYearRange: { from: referenceYear - 17, to: referenceYear - 16 },
      },
      {
        category: 'U20',
        nameAr: CATEGORY_NAMES_AR.U20,
        minAge: 18,
        maxAge: 19,
        birthYearRange: { from: referenceYear - 19, to: referenceYear - 18 },
      },
      {
        category: 'SENIOR',
        nameAr: CATEGORY_NAMES_AR.SENIOR,
        minAge: 20,
        maxAge: 34,
        birthYearRange: { from: referenceYear - 34, to: referenceYear - 20 },
      },
      {
        category: 'MASTER',
        nameAr: CATEGORY_NAMES_AR.MASTER,
        minAge: 35,
        maxAge: 99,
        birthYearRange: { from: referenceYear - 99, to: referenceYear - 35 },
      },
    ];
  }

  /**
   * التحقق من أهلية عداء للمشاركة في فئة عمرية معينة
   * تسمح اللائحة للعداء أحياناً بالمشاركة في فئة أعلى (Surclassement) إذا نصت لوائح البطولة
   */
  public static validateAthleteCategory(
    athlete: Athlete,
    targetCategory: AgeCategory,
    referenceYear: number = new Date().getFullYear(),
    allowSurclassement: boolean = false
  ): { eligible: boolean; calculatedCategory: AgeCategory; reason?: string } {
    const { category, age } = this.calculateCategory(athlete.birthDate, referenceYear);

    if (targetCategory === 'OPEN') {
      return { eligible: true, calculatedCategory: category };
    }

    if (category === targetCategory) {
      return { eligible: true, calculatedCategory: category };
    }

    // فحص الترقية الرياضية إلى فئة أعلى (Surclassement): U18 إلى U20، أو U20 إلى Senior
    if (allowSurclassement) {
      if (category === 'U18' && (targetCategory === 'U20' || targetCategory === 'SENIOR')) {
        return { eligible: true, calculatedCategory: category, reason: 'ترقية رياضية (Surclassement)' };
      }
      if (category === 'U20' && targetCategory === 'SENIOR') {
        return { eligible: true, calculatedCategory: category, reason: 'ترقية رياضية (Surclassement)' };
      }
      // قدماء Master يمكنهم التسابق في فئة Senior
      if (category === 'MASTER' && targetCategory === 'SENIOR') {
        return { eligible: true, calculatedCategory: category, reason: 'مشاركة قدماء في فئة الأكابر' };
      }
    }

    return {
      eligible: false,
      calculatedCategory: category,
      reason: `عمر العداء (${age} سنة) يضعه في فئة (${CATEGORY_NAMES_AR[category]}) ولا يطابق فئة المسابقة (${CATEGORY_NAMES_AR[targetCategory]}).`,
    };
  }

  /**
   * تجميد لقطة الفئات للمنافسة (Freeze Category Snapshot)
   * تضمن عدم تأثر نتائج وأعمار المتسابقين في البطولة عند مرور السنوات لاحقاً
   */
  public static createCategorySnapshot(
    competitionId: string,
    athletes: Athlete[],
    referenceYear: number = new Date().getFullYear()
  ): CategorySnapshot {
    const rules = this.getCategoryRules(referenceYear);
    const athleteSnapshots = athletes.map((ath) => {
      const { category, age } = this.calculateCategory(ath.birthDate, referenceYear);
      return {
        athleteId: ath.id,
        birthDate: ath.birthDate,
        calculatedCategory: category,
        ageAtCompetition: age,
      };
    });

    return {
      competitionId,
      referenceYear,
      frozenAt: Date.now(),
      rules,
      athleteSnapshots,
    };
  }
}
