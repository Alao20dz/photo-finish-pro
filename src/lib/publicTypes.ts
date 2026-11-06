/** أنواع البيانات العامة المعروضة في الموقع (مرآة لـ public_competitions view) */

export interface PublicLeague {
  id: string;
  nameAr: string;
  nameFr: string | null;
  wilaya: string;
  code: string;
  colors?: { primary?: string; secondary?: string } | null;
  clubsCount: number;
}

export interface PublicCompetition {
  id: string;
  titleAr: string;
  type: string; // track | field | cross_country | road
  venue: string;
  startDate: string;
  endDate: string;
  status: string;
  registrationDeadline: string | null;
  eventsCount: number;
  league: PublicLeague;
}

export interface PlatformStats {
  leagues: number;
  clubs: number;
  athletes: number;
  competitions: number;
  registrations: number;
}

export interface PublicResultItem {
  id: string;
  competitionTitle: string;
  discipline: string;
  athlete: string;
  club: string;
  mark: string;
  status: "official" | "running";
}
