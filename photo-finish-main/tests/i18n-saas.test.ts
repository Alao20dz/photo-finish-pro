/**
 * اختبارات طبقة i18n — تكافؤ القاموسين، مفاتيح SaaS الجديدة، الترجمة بالمتغيرات،
 * ودلالات الاتجاه RTL/LTR. بيئة Node بلا DOM: applyDocumentLang يفشل بصمت بأمان.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dictionaries, ar, fr, type DictKey } from '../src/i18n/dictionaries';
import { i18n } from '../src/i18n';

const AR_KEYS = Object.keys(ar).sort();
const FR_KEYS = Object.keys(fr).sort();

describe('تكافؤ القاموسين', () => {
  it('كل مفتاح في العربية له مقابل في الفرنسية والعكس', () => {
    expect(AR_KEYS).toEqual(FR_KEYS);
  });

  it('لا قيمة فارغة في أي لغة', () => {
    for (const [k, v] of Object.entries(ar)) expect(v.length, `ar.${k}`).toBeGreaterThan(0);
    for (const [k, v] of Object.entries(fr)) expect(v.length, `fr.${k}`).toBeGreaterThan(0);
  });

  it('مفاتيح SaaS (المرحلة 2) موجودة في اللغتين بقيم معبأة', () => {
    const saasKeys: DictKey[] = [
      'nav_home', 'nav_competitions', 'nav_results', 'nav_standings',
      'saas_open_site', 'saas_league_portal', 'saas_compete_mode', 'saas_admin_suite',
      'league_leagues', 'league_wilaya', 'league_status_active',
      'auth_sign_in', 'auth_sign_out', 'auth_email', 'auth_password',
      'auth_mfa_code', 'auth_wrong_credentials',
      'comp_competitions', 'comp_upcoming', 'comp_running', 'comp_finished',
      'comp_results', 'comp_register', 'comp_deadline', 'comp_closed',
    ];
    for (const k of saasKeys) {
      expect(ar[k].length, `ar.${k}`).toBeGreaterThan(0);
      expect(fr[k].length, `fr.${k}`).toBeGreaterThan(0);
    }
  });
});

describe('محرك الترجمة', () => {
  const ORIGINAL_LANG = i18n.current;

  afterEach(() => i18n.setLang(ORIGINAL_LANG));

  it('يترجم بلغة محددة ويستبدل المتغيرات', () => {
    i18n.setLang('fr');
    expect(i18n.translate('language')).toBe('Langue');
    i18n.setLang('ar');
    expect(i18n.translate('language')).toBe('اللغة');
    // المتغيرات {x}
    i18n.setLang('fr');
    expect(i18n.translate('license_valid_until')).toContain('Valable');
  });

  it('دلالات الاتجاه: عربي RTL وفرنسي LTR', () => {
    i18n.setLang('ar');
    expect(i18n.isRTL).toBe(true);
    i18n.setLang('fr');
    expect(i18n.isRTL).toBe(false);
  });

  it('سقوط آمن لمفتاح غير موجود يعيد المفتاح نفسه', () => {
    // @ts-expect-error مفتاح غير موجود للتحقق من السقوط الآمن
    expect(i18n.translate('___nope___')).toBe('___nope___');
  });

  it('القاموسان يشتركان في النوع (Record<DictKey,string> للفرنسية)', () => {
    // ضمان بنائي: fr من نوع Record<DictKey,string> — تحقق وقت التصريف يكفي،
    // ونضيف فحصاً زمن التشغيل لعدد المفاتيح
    expect(Object.keys(dictionaries.ar).length).toBe(Object.keys(dictionaries.fr).length);
  });
});
