"use client";

/* eslint-disable jsx-a11y/alt-text */

import { Document, Page, Text, View, StyleSheet, Svg, Path, Circle, Image } from "@react-pdf/renderer";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const COLORS = {
  // Primary navy (used for section titles, timeline dot border, language bar fill)
  primary:      "#071738",
  // Emerald accent (AVAILABLE badge, active timeline dot, checkmark bullets, emerald text)
  accent:       "#10B981",
  accentDark:   "#059669",   // company names
  accentLight:  "#ECFDF5",   // emerald-50 (active dot border)
  // Neutral
  dark:         "#0F172A",   // slate-900 (headings, name)
  mid:          "#334155",   // slate-700 (body text)
  muted:        "#64748B",   // slate-500 (meta, contact)
  faint:        "#94A3B8",   // slate-400 (icons)
  divider:      "#E2E8F0",   // slate-200 (borders, progress track, timeline line)
  surface:      "#F8FAFC",   // slate-50 (sidebar bg, date badge bg)
  borderSoft:   "#F1F5F9",   // slate-100 (date badge bg)
  white:        "#FFFFFF",
};

const FONT = {
  h1:    22,
  h2:    15,
  h3:    13,
  body:  9.5,
  small: 8,
  xs:    7,
};

const SIDEBAR_WIDTH = "37%";
const CONTENT_WIDTH = "63%";

// ─── SVG Icon helpers ─────────────────────────────────────────────────────────
const SZ = 9;
const SZL = 11; // larger icons for main section headers

const IconMapPin = () => (
  <Svg width={SZ} height={SZ} viewBox="0 0 24 24">
    <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke={COLORS.faint} strokeWidth="2" fill="none"/>
    <Circle cx="12" cy="9" r="2.5" stroke={COLORS.faint} strokeWidth="2" fill="none"/>
  </Svg>
);

const IconMail = () => (
  <Svg width={SZ} height={SZ} viewBox="0 0 24 24">
    <Path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke={COLORS.faint} strokeWidth="2" fill="none"/>
    <Path d="M22 6l-10 7L2 6" stroke={COLORS.faint} strokeWidth="2" fill="none"/>
  </Svg>
);

const IconPhone = () => (
  <Svg width={SZ} height={SZ} viewBox="0 0 24 24">
    <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.77a16 16 0 0 0 6.35 6.35l.95-.95a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" stroke={COLORS.faint} strokeWidth="2" fill="none"/>
  </Svg>
);

const IconGlobe = () => (
  <Svg width={SZ} height={SZ} viewBox="0 0 24 24">
    <Circle cx="12" cy="12" r="10" stroke={COLORS.faint} strokeWidth="2" fill="none"/>
    <Path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke={COLORS.faint} strokeWidth="2" fill="none"/>
  </Svg>
);

// Gear/settings icon for Technical Skills
const IconGear = () => (
  <Svg width={SZ} height={SZ} viewBox="0 0 24 24">
    <Path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" stroke={COLORS.dark} strokeWidth="2" fill="none"/>
    <Circle cx="12" cy="12" r="3" stroke={COLORS.dark} strokeWidth="2" fill="none"/>
  </Svg>
);

// Check circle icon for Core Competencies
const IconCheckCircle = () => (
  <Svg width={SZ} height={SZ} viewBox="0 0 24 24">
    <Path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke={COLORS.dark} strokeWidth="2" fill="none"/>
  </Svg>
);

// Language/translation icon
const IconLang = () => (
  <Svg width={SZ} height={SZ} viewBox="0 0 24 24">
    <Path d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" stroke={COLORS.dark} strokeWidth="2" fill="none" strokeLinecap="round"/>
  </Svg>
);

// User icon for main section
const IconUser = () => (
  <Svg width={SZL} height={SZL} viewBox="0 0 24 24">
    <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke={COLORS.primary} strokeWidth="2" fill="none"/>
    <Circle cx="12" cy="7" r="4" stroke={COLORS.primary} strokeWidth="2" fill="none"/>
  </Svg>
);

// Briefcase icon for Work Experience
const IconBriefcase = () => (
  <Svg width={SZL} height={SZL} viewBox="0 0 24 24">
    <Path d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke={COLORS.primary} strokeWidth="2" fill="none"/>
  </Svg>
);

// Graduation cap for Education
const IconGradCap = () => (
  <Svg width={SZL} height={SZL} viewBox="0 0 24 24">
    <Path d="M12 14l9-5-9-5-9 5 9 5z" stroke={COLORS.primary} strokeWidth="2" fill="none"/>
    <Path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" stroke={COLORS.primary} strokeWidth="2" fill="none"/>
  </Svg>
);

// Check icon for experience bullets
const IconCheck = () => (
  <Svg width={SZ} height={SZ} viewBox="0 0 24 24">
    <Path d="M5 13l4 4L19 7" stroke={COLORS.accent} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    flexDirection: "row",
    fontFamily: "Helvetica",
    backgroundColor: COLORS.white,
  },

  // ── Columns ─────────────────────────────────────────────────────────────────
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: COLORS.surface,
    paddingTop: 30,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderRightWidth: 1,
    borderRightColor: COLORS.divider,
  },
  content: {
    width: CONTENT_WIDTH,
    paddingTop: 30,
    paddingBottom: 30,
    paddingLeft: 24,
    paddingRight: 24,
    backgroundColor: COLORS.white,
  },

  // ── Profile (sidebar) ────────────────────────────────────────────────────────
  profileSection: {
    alignItems: "center",
    marginBottom: 15,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: COLORS.white,
    overflow: "hidden",
    marginBottom: 6,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarInitials: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: COLORS.white,
  },
  // "AVAILABLE" badge — emerald pill
  fullName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: COLORS.dark,
    textAlign: "center",
    marginBottom: 10,
  },

  // Contact items
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginBottom: 5,
  },
  contactText: {
    fontSize: FONT.small,
    color: COLORS.muted,
    textAlign: "center",
  },

  // ── Sidebar section ──────────────────────────────────────────────────────────
  sidebarSection: {
    marginBottom: 20,
  },
  sidebarSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 10,
  },
  sidebarSectionTitle: {
    fontSize: FONT.small,
    fontFamily: "Helvetica-Bold",
    color: COLORS.dark,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  // ── Skill tags ───────────────────────────────────────────────────────────────
  skillsWrap: {
    flexDirection: "column",
  },
  skillsRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  skillTag: {
    width: "55%",
    marginRight: "1%",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.divider,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignItems: "center",
  },
  skillTagText: {
    fontSize: FONT.small,
    color: COLORS.mid,
  },

  // ── Core Competencies ────────────────────────────────────────────────────────
  competencyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 5,
    gap: 4,
  },
  competencyBullet: {
    fontSize: FONT.body,
    color: COLORS.accent,
    marginTop: 0.5,
    fontFamily: "Helvetica-Bold",
  },
  competencyText: {
    flex: 1,
    fontSize: FONT.body,
    color: COLORS.mid,
    lineHeight: 1.45,
  },

  // ── Languages ────────────────────────────────────────────────────────────────
  langItem: {
    marginBottom: 10,
  },
  langHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  langName: {
    fontSize: FONT.body,
    fontFamily: "Helvetica-Bold",
    color: COLORS.mid,
  },
  langLevel: {
    fontSize: FONT.xs,
    color: COLORS.muted,
    textTransform: "uppercase",
  },
  langBarTrack: {
    height: 5,
    backgroundColor: COLORS.divider,
    borderRadius: 999,
  },
  langBarFill: {
    height: 5,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
  },

  // ── Main section headers ─────────────────────────────────────────────────────
  mainSection: {
    marginBottom:20,
  },
  mainSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  mainSectionTitle: {
    fontSize: FONT.h2,
    fontFamily: "Helvetica-Bold",
    color: COLORS.dark,
  },

  // ── Summary ──────────────────────────────────────────────────────────────────
  summaryBox: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: COLORS.surface,
  },
  summaryText: {
    fontSize: 9,
    color: COLORS.mid,
    lineHeight: 1.55,
  },

  // ── Experience (timeline) ────────────────────────────────────────────────────
  timelineItem: {
    position: "relative",
    paddingLeft: 20,
    marginBottom: 18,
  },
  // Active dot (first item) — filled emerald
  timelineDotActive: {
    position: "absolute",
    left: 0,
    top: 3,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accent,
    borderWidth: 3,
    borderColor: COLORS.accentLight,
  },
  // Inactive dot — white with border
  timelineDot: {
    position: "absolute",
    left: 0,
    top: 3,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: COLORS.divider,
    backgroundColor: COLORS.white,
  },
  timelineLine: {
    position: "absolute",
    left: 4,
    top: 16,
    width: 2,
    bottom: -10,
    backgroundColor: COLORS.divider,
  },
  expItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 2,
    gap: 8,
  },
  expItemLeft: {
    flex: 1,
  },
  jobTitle: {
    fontSize: FONT.h3,
    fontFamily: "Helvetica-Bold",
    color: COLORS.dark,
    marginBottom: 2,
  },
  companyText: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: COLORS.accentDark,
    marginBottom: 2,
  },
  dateBadge: {
    fontSize: FONT.small,
    color: COLORS.muted,
    backgroundColor: COLORS.borderSoft,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 3,
    gap: 4,
    marginTop: 3,
  },
  bulletText: {
    flex: 1,
    fontSize: FONT.small,
    color: COLORS.mid,
    lineHeight: 1.45,
  },

  // ── Education ────────────────────────────────────────────────────────────────
  eduItem: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.divider,
    paddingLeft: 10,
    marginBottom: 14,
  },
  eduItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  eduItemLeft: {
    flex: 1,
  },
  degreeText: {
    fontSize: FONT.h3,
    fontFamily: "Helvetica-Bold",
    color: COLORS.dark,
    marginBottom: 2,
  },
  fieldText: {
    fontSize: FONT.body,
    color: COLORS.mid,
    marginBottom: 2,
  },
  schoolText: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: COLORS.accentDark,
    marginBottom: 4,
  },

  // ── Watermark ────────────────────────────────────────────────────────────────
  watermarkImage: {
    position: "absolute",
    top: 330,
    left: 100,
    width: 280,
    height: 180,
    opacity: 0.05,
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
export interface Candidate {
  id: string;
  firstName: string | null;
  lastName: string | null;
  summary: string | null;
  location: string | null;
  phone: string | null;
  avatarUrl: string | null;
  linkedinUrl: string | null;
  targetJobRole: string | null;
  user?: { email: string | null; image: string | null };
  experiences: Array<{
    id: string; company: string; title: string; location: string | null;
    startDate: Date; endDate: Date | null; isCurrent: boolean; description: string | null;
  }>;
  education: Array<{
    id: string; school: string; degree: string; fieldOfStudy: string | null;
    startDate: Date; endDate: Date | null; isCurrent: boolean;
  }>;
  languages: Array<{ id: string; name: string; proficiency: string }>;
  skills: Array<{ id: string; name: string; level: string | null }>;
}

function getInitials(firstName: string | null, lastName: string | null): string {
  const f = (firstName || "").charAt(0).toUpperCase();
  const l = (lastName || "").charAt(0).toUpperCase();
  return (f + l) || "U";
}

function getProficiencyPercent(proficiency: string): number {
  const map: Record<string, number> = {
    NATIVE: 100, FLUENT: 80, ADVANCED: 60, INTERMEDIATE: 40, BASIC: 20,
  };
  return map[proficiency.toUpperCase()] ?? 20;
}

function formatMonthYear(date: Date | null | undefined): string {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase();
}

function formatDateRange(startDate: Date, endDate: Date | null, isCurrent: boolean): string {
  const start = formatMonthYear(startDate);
  const end = isCurrent ? "PRESENT" : endDate ? formatMonthYear(endDate) : "PRESENT";
  return `${start} — ${end}`;
}

function parseDescription(description: string | null): string[] {
  if (!description) return [];
  return description.split(/\n|•|-/).map((l) => l.trim()).filter(Boolean);
}

function getCoreCompetencies(targetJobRole: string | null): string[] {
  const competencies: Record<string, string[]> = {
    CALL_CENTER: ["Conflict Resolution", "SLA Compliance", "Team Leadership", "Process Optimization"],
    SALES: ["Communication", "Negotiation", "CRM Management", "Lead Generation"],
    TECH_SUPPORT: ["Troubleshooting", "Technical Documentation", "Ticket Management", "System Administration"],
    CUSTOMER_SERVICE: ["Customer Relations", "Problem Solving", "Multi-channel Support", "Quality Assurance"],
    ADMIN: ["Data Entry", "Office Management", "Scheduling", "Documentation"],
    GENERAL: ["Communication", "Time Management", "Adaptability", "Organization"],
  };
  return competencies[targetJobRole || "GENERAL"] || competencies["GENERAL"];
}

// ─── Sidebar section wrapper ──────────────────────────────────────────────────
function SidebarSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.sidebarSection}>
      <View style={styles.sidebarSectionHeader}>
        {icon}
        <Text style={styles.sidebarSectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// ─── Document ─────────────────────────────────────────────────────────────────
interface CVPDFDocumentProps {
  candidate: Candidate;
  watermarkSrc?: string | null;
}

export function CVPDFDocument({ candidate, watermarkSrc }: CVPDFDocumentProps) {
  const fullName = `${candidate.lastName || ""} ${candidate.firstName || ""}`.trim() || "Your Name";
  const initials = getInitials(candidate.firstName, candidate.lastName);
  const competencies = getCoreCompetencies(candidate.targetJobRole);
  const watermarkImage = watermarkSrc?.trim() || null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
        <View style={styles.sidebar}>


          {/* Profile Card */}
          <View style={styles.profileSection}>
            {/* Avatar */}
            <View style={styles.avatarContainer}>
              {(candidate.avatarUrl || candidate.user?.image) ? (
                <Image
                  style={styles.avatarImage}
                  src={(candidate.avatarUrl || candidate.user?.image) as string}
                />
              ) : (
                <Text style={styles.avatarInitials}>{initials}</Text>
              )}
            </View>

            {/* AVAILABLE badge */}
          

            {/* Full name */}
            <Text style={styles.fullName}>{fullName}</Text>

            {/* Contact items */}
            {candidate.location && (
              <View style={styles.contactItem}>
                <IconMapPin />
                <Text style={styles.contactText}>{candidate.location.toUpperCase()}</Text>
              </View>
            )}
            {candidate.user?.email && (
              <View style={styles.contactItem}>
                <IconMail />
                <Text style={styles.contactText}>{candidate.user.email}</Text>
              </View>
            )}
            {candidate.phone && (
              <View style={styles.contactItem}>
                <IconPhone />
                <Text style={styles.contactText}>{candidate.phone}</Text>
              </View>
            )}
            {candidate.linkedinUrl && (
              <View style={styles.contactItem}>
                <IconGlobe />
                <Text style={styles.contactText}>
                  {candidate.linkedinUrl.replace(/^https?:\/\/(www\.)?/, "")}
                </Text>
              </View>
            )}
          </View>

          {/* Technical Skills — max 8, 2 per row */}
          {candidate.skills.length > 0 && (
            <SidebarSection icon={<IconGear />} title="Technical Skills">
              <View style={styles.skillsWrap}>
                {Array.from({ length: Math.ceil(Math.min(candidate.skills.length, 8) / 2) }).map((_, rowIdx) => {
                  const a = candidate.skills[rowIdx * 2];
                  const b = candidate.skills[rowIdx * 2 + 1];
                  return (
                    <View key={rowIdx} style={styles.skillsRow}>
                      <View style={styles.skillTag}>
                        <Text style={styles.skillTagText}>{a.name}</Text>
                      </View>
                      {b ? (
                        <View style={[styles.skillTag, { marginRight: 0 }]}>
                          <Text style={styles.skillTagText}>{b.name}</Text>
                        </View>
                      ) : (
                        <View style={{ width: "48%" }} />
                      )}
                    </View>
                  );
                })}
              </View>
            </SidebarSection>
          )}

          {/* Core Competencies */}
          <SidebarSection icon={<IconCheckCircle />} title="Core Competencies">
            {competencies.map((c, i) => (
              <View key={i} style={styles.competencyRow}>
                <Text style={styles.competencyBullet}>•</Text>
                <Text style={styles.competencyText}>{c}</Text>
              </View>
            ))}
          </SidebarSection>

          {/* Languages */}
          {candidate.languages.length > 0 && (
            <SidebarSection icon={<IconLang />} title="Languages">
              {candidate.languages.map((lang) => {
                const pct = getProficiencyPercent(lang.proficiency);
                return (
                  <View key={lang.id} style={styles.langItem}>
                    <View style={styles.langHeader}>
                      <Text style={styles.langName}>{lang.name}</Text>
                      <Text style={styles.langLevel}>{lang.proficiency}</Text>
                    </View>
                    <View style={styles.langBarTrack}>
                      <View style={[styles.langBarFill, { width: `${pct}%` }]} />
                    </View>
                  </View>
                );
              })}
            </SidebarSection>
          )}

        </View>

        {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
        <View style={styles.content}>

          {/* Professional Summary */}
          {candidate.summary && (
            <View style={styles.mainSection}>
              <View style={styles.mainSectionHeader}>
                <IconUser />
                <Text style={styles.mainSectionTitle}>Professional Summary</Text>
              </View>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryText}>{candidate.summary}</Text>
              </View>
            </View>
          )}

          {/* Work Experience — max 4 most recent */}
          {candidate.experiences.length > 0 && (
            <View style={styles.mainSection}>
              <View style={styles.mainSectionHeader}>
                <IconBriefcase />
                <Text style={styles.mainSectionTitle}>Work Experience</Text>
              </View>
              {candidate.experiences.slice(0, 4).map((exp, index) => {
                const bullets = parseDescription(exp.description);
                return (
                  <View key={exp.id} style={styles.timelineItem} wrap={false}>
                    {/* Timeline dot */}
                    <View style={index === 0 ? styles.timelineDotActive : styles.timelineDot} />
                    {/* Connector line (not last) */}
                    {index !== Math.min(candidate.experiences.length, 4) - 1 && (
                      <View style={styles.timelineLine} />
                    )}

                    <View style={styles.expItemHeader}>
                      <View style={styles.expItemLeft}>
                        <Text style={styles.jobTitle}>{exp.title}</Text>
                        <Text style={styles.companyText}>{exp.company}</Text>
                        {exp.location && (
                          <Text style={{ fontSize: FONT.small, color: COLORS.muted, marginBottom: 3 }}>
                            {exp.location}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.dateBadge}>
                        {formatDateRange(exp.startDate, exp.endDate, exp.isCurrent)}
                      </Text>
                    </View>

                    {bullets.map((bullet, i) => (
                      <View key={i} style={styles.bulletRow}>
                        <IconCheck />
                        <Text style={styles.bulletText}>{bullet}</Text>
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          )}

          {/* Education — max 3 most recent */}
          {candidate.education.length > 0 && (
            <View style={styles.mainSection}>
              <View style={styles.mainSectionHeader}>
                <IconGradCap />
                <Text style={styles.mainSectionTitle}>Education</Text>
              </View>
              {candidate.education.slice(0, 3).map((edu) => (
                <View key={edu.id} style={styles.eduItem} wrap={false}>
                  <View style={styles.eduItemHeader}>
                    <View style={styles.eduItemLeft}>
                      <Text style={styles.degreeText}>{edu.degree}</Text>
                      {edu.fieldOfStudy && (
                        <Text style={styles.fieldText}>{edu.fieldOfStudy}</Text>
                      )}
                      <Text style={styles.schoolText}>{edu.school}</Text>
                    </View>
                    <Text style={styles.dateBadge}>
                      {formatDateRange(edu.startDate, edu.endDate, edu.isCurrent)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

        </View>

        {/* Watermark - absolute on Page, rendered last so it overlays full page */}
        {watermarkImage && (
          <Image
            fixed
            style={styles.watermarkImage}
            src={watermarkImage}
            cache={false}
          />
        )}

      </Page>
    </Document>
  );
}
