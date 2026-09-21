export interface CompanyAnalyticsPeriod {
  days: number;
  from: string;
  to: string;
  language: string | null;
}

export interface CompanyAnalyticsMainKpis {
  totalViews: number;
  totalJobListings: number;
  activeJobListings: number;
  receivedApplications: number;
}

export interface CompanyAnalyticsGender {
  totalAnalyzed: number;
  female: { count: number; percentage: number };
  male: { count: number; percentage: number };
}

export interface CompanyAnalyticsAge {
  "18-24": number;
  "25-34": number;
  "35-44": number;
  "45-55": number;
  "55+": number;
}

export interface CompanyAnalyticsJobPerformance {
  id: string;
  title: string;
  primaryLanguage: string;
  location: string;
  views: number;
  applications: number;
  conversionRate: number;
  status: string;
}

export interface CompanyAnalyticsFilters {
  availableLanguages: string[];
}

export interface CompanyAnalyticsData {
  period: CompanyAnalyticsPeriod;
  mainKpis: CompanyAnalyticsMainKpis;
  gender: CompanyAnalyticsGender;
  age: CompanyAnalyticsAge;
  jobPerformance: CompanyAnalyticsJobPerformance[];
  filters: CompanyAnalyticsFilters;
}

export interface CompanyAnalyticsResponse {
  success: true;
  data: CompanyAnalyticsData;
}
