/**
 * Photo Finish Pro — خطاف React لهوية الرابطة (useLeagueTheme)
 * ============================================================
 * يتيح للمكوّنات قراءة هوية الرابطة النشطة والاشتراك في تغييراتها.
 * الاستخدام:
 *   const league = useLeagueTheme();
 *   {league && <span style={{ color: 'var(--pf-primary)' }}>{league.nameAr}</span>}
 */

import { useEffect, useState } from 'react';
import {
  getActiveLeagueTheme,
  subscribeLeagueTheme,
  type LeagueBranding
} from '../services/leagueTheme';

export function useLeagueTheme(): LeagueBranding | null {
  const [branding, setBranding] = useState<LeagueBranding | null>(getActiveLeagueTheme());

  useEffect(() => subscribeLeagueTheme(() => setBranding(getActiveLeagueTheme())), []);

  return branding;
}
