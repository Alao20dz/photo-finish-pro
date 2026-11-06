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
import { PublicHome } from './PublicHome';
import { LeaguePage } from './LeaguePage';

export const PublicSite: React.FC = () => {
  const [path, setPath] = useState<string>(() => router.current());

  useEffect(() => router.subscribe(setPath), []);

  const leagueMatch = matchRoute(ROUTES.LEAGUE, path);
  if (leagueMatch) {
    return <LeaguePage key={leagueMatch.params.id} leagueId={leagueMatch.params.id} />;
  }
  return <PublicHome />;
};
