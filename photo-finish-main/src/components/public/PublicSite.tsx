/**
 * Photo Finish Pro — حاوية الموقع العمومي (Public Site Switch)
 * ===========================================================
 * تشترك في تغييرات الموجّه وتعرض:
 *   ‎#/league/:id‎ → صفحة الرابطة
 *   ما عدا ذلك    → الرئيسية (دليل الرابطات)
 * تُستخدم من AppRoot عندما يكون قرار الدخول 'public-home' أو 'league'.
 */

import React, { useEffect, useState } from 'react';
import { matchRoute, router, ROUTES } from '../../services/router';
import { track } from '../../services/analyticsService';
import { useI18n } from '../../i18n';
import { PublicHome } from './PublicHome';
import { LeaguePage } from './LeaguePage';

export const PublicSite: React.FC = () => {
  const [path, setPath] = useState<string>(() => router.current());
  const { lang } = useI18n();

  useEffect(() => router.subscribe(setPath), []);

  // ═══ عدّ الزيارات (المرحلة 8) — مجهول بلا كوكيز، يحترم DNT، تكرار مضاد ═══
  useEffect(() => {
    const leagueId = matchRoute(ROUTES.LEAGUE, path)?.params.id ?? null;
    track({ kind: 'page_view', path, leagueId, lang });
  }, [path, lang]);

  const leagueMatch = matchRoute(ROUTES.LEAGUE, path);
  if (leagueMatch) {
    return <LeaguePage key={leagueMatch.params.id} leagueId={leagueMatch.params.id} />;
  }
  return <PublicHome />;
};
