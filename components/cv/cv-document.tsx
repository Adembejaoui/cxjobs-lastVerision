import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

/* =========================
   Types
========================= */
interface Experience {
  id: string;
  company: string;
  title: string;
  location: string | null;
  startDate: Date;
  endDate: Date | null;
  isCurrent: boolean;
  description: string | null;
}

interface Education {
  id: string;
  school: string;
  degree: string;
  fieldOfStudy: string | null;
  startDate: Date;
  endDate: Date | null;
  isCurrent: boolean;
}

interface Language {
  id: string;
  name: string;
  proficiency: string;
}

interface Skill {
  id: string;
  name: string;
  level: string | null;
}

interface Candidate {
  id: string;
  firstName: string | null;
  lastName: string | null;
  summary: string | null;
  location: string | null;
  phone: string | null;
  avatarUrl: string | null;
  linkedinUrl: string | null;
  targetJobRole: string | null;
  user?: {
    email: string | null;
    image: string | null;
  };
  experiences: Experience[];
  education: Education[];
  languages: Language[];
  skills: Skill[];
}

interface CVDocumentProps {
  candidate: Candidate;
}

/* =========================
   Design Tokens
========================= */
const COLORS = {
  white: "#FFFFFF",
  pageBg: "#FFFFFF",
  sidebarBg: "#F8FAFC",
  text: "#0F172A",
  textSoft: "#334155",
  textMuted: "#64748B",
  border: "#E2E8F0",
  borderSoft: "#F1F5F9",
  primary: "#0F172A",
  accent: "#10B981",
  accentSoft: "#ECFDF5",
  company: "#059669",
  summaryBg: "#F8FAFC",
};

const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 30,
};

const FONT = {
  h1: 22,
  h2: 15,
  h3: 12,
  body: 9.5,
  small: 8,
  xs: 7,
};

const RADIUS = {
  sm: 4,
  md: 8,
  pill: 999,
};

const SIDEBAR_WIDTH = "32%";
const CONTENT_WIDTH = "68%";

/* =========================
   Helpers
========================= */
function safeText(value?: string | null, fallback = ""): string {
  return value?.trim() || fallback;
}

function getFullName(candidate: Candidate): string {
  const firstName = safeText(candidate.firstName);
  const lastName = safeText(candidate.lastName);
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || "Your Name";
}

function getContactLines(candidate: Candidate): string[] {
  const lines: string[] = [];

  if (candidate.location) lines.push(candidate.location.toUpperCase());
  if (candidate.user?.email) lines.push(candidate.user.email);
  if (candidate.phone) lines.push(candidate.phone);
  if (candidate.linkedinUrl) {
    lines.push(candidate.linkedinUrl.replace(/^https?:\/\//, "").replace(/^www\./, ""));
  }

  return lines;
}

function formatMonthYear(date: Date | null | undefined): string {
  if (!date) return "";
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "";

  return parsed
    .toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    })
    .toUpperCase();
}

function formatDateRange(startDate: Date, endDate: Date | null, isCurrent: boolean): string {
  const start = formatMonthYear(startDate);
  const end = isCurrent ? "PRESENT" : endDate ? formatMonthYear(endDate) : "PRESENT";
  return `${start} — ${end}`;
}

function getProficiencyPercent(proficiency: string): number {
  const map: Record<string, number> = {
    NATIVE: 100,
    FLUENT: 85,
    ADVANCED: 70,
    INTERMEDIATE: 50,
    BASIC: 30,
  };

  return map[proficiency.toUpperCase()] || 30;
}

function parseDescription(description: string | null): string[] {
  if (!description) return [];

  return description
    .split(/\n|•|-/)
    .map((line) => line.trim())
    .filter(Boolean);
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

  return competencies[targetJobRole || "GENERAL"] || competencies.GENERAL;
}

/* =========================
   Styles
========================= */
const styles = StyleSheet.create({
  page: {
    flexDirection: "row",
    backgroundColor: COLORS.pageBg,
    fontFamily: "Helvetica",
    color: COLORS.text,
  },

  /* Columns */
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: COLORS.sidebarBg,
    paddingTop: SPACING.xxxl,
    paddingBottom: SPACING.xxxl,
    paddingHorizontal: 24,
  },
  content: {
    width: CONTENT_WIDTH,
    paddingTop: SPACING.xxxl,
    paddingBottom: SPACING.xxxl,
    paddingLeft: 28,
    paddingRight: 30,
  },

  /* Generic */
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginVertical: SPACING.lg,
    width: "100%",
  },
  sectionBlock: {
    marginBottom: SPACING.xl,
  },
  sidebarSectionTitle: {
    fontSize: FONT.small,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  contentSectionHeader: {
    marginBottom: SPACING.md,
  },
  contentSectionTitle: {
    fontSize: FONT.h2,
    fontWeight: 700,
    color: COLORS.text,
  },

  /* Profile */
  profileSection: {
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    marginBottom: SPACING.sm,
  },
  avatarPlaceholder: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  availabilityBadge: {
    backgroundColor: COLORS.accent,
    color: COLORS.white,
    fontSize: FONT.small,
    fontWeight: 700,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    marginBottom: SPACING.md,
  },
  fullName: {
    fontSize: FONT.h1,
    fontWeight: 700,
    textAlign: "center",
    color: COLORS.text,
    marginBottom: SPACING.sm,
    lineHeight: 1.2,
  },
  targetRole: {
    fontSize: FONT.body,
    color: COLORS.textSoft,
    textAlign: "center",
    marginBottom: SPACING.md,
  },
  contactItem: {
    fontSize: FONT.body,
    color: COLORS.textMuted,
    textAlign: "center",
    marginBottom: 5,
    lineHeight: 1.35,
  },

  /* Sidebar skill tags */
  skillsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 2,
  },
  skillTag: {
    fontSize: FONT.small,
    color: COLORS.textSoft,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6,
  },

  /* Competencies */
  competencyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  competencyBullet: {
    width: 10,
    fontSize: FONT.body,
    color: COLORS.accent,
    marginTop: 0.5,
  },
  competencyText: {
    flex: 1,
    fontSize: FONT.body,
    color: COLORS.textSoft,
    lineHeight: 1.45,
  },

  /* Languages */
  languageItem: {
    marginBottom: SPACING.sm,
  },
  languageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  languageName: {
    fontSize: FONT.body,
    fontWeight: 700,
    color: COLORS.textSoft,
  },
  languageLevel: {
    fontSize: FONT.small,
    color: COLORS.textMuted,
    textTransform: "uppercase",
  },
  progressTrack: {
    height: 5,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.pill,
  },
  progressFill: {
    height: 5,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.pill,
  },

  /* Summary */
  summaryWrapper: {
    marginBottom: SPACING.xxl,
  },
  summaryBox: {
    backgroundColor: COLORS.summaryBg,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: RADIUS.sm,
  },
  summaryText: {
    fontSize: 10,
    color: COLORS.textSoft,
    lineHeight: 1.55,
  },

  /* Experience */
  experienceSection: {
    marginBottom: SPACING.xxl,
  },
  timelineItem: {
    position: "relative",
    paddingLeft: 20,
    marginBottom: 18,
  },
  timelineDot: {
    position: "absolute",
    left: 0,
    top: 3,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  timelineDotActive: {
    position: "absolute",
    left: 0,
    top: 3,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accent,
  },
  timelineLine: {
    position: "absolute",
    left: 4,
    top: 16,
    width: 2,
    bottom: -10,
    backgroundColor: COLORS.border,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 5,
  },
  itemHeaderLeft: {
    flexGrow: 1,
    flexShrink: 1,
    paddingRight: 10,
  },
  jobTitle: {
    fontSize: FONT.h3,
    fontWeight: 700,
    color: COLORS.text,
    marginBottom: 2,
  },
  companyText: {
    fontSize: 10,
    fontWeight: 700,
    color: COLORS.company,
    marginBottom: 2,
  },
  itemMeta: {
    fontSize: FONT.small,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  dateBadge: {
    fontSize: FONT.small,
    color: COLORS.textMuted,
    backgroundColor: COLORS.borderSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 3,
  },
  bulletIcon: {
    width: 10,
    fontSize: FONT.body,
    color: COLORS.accent,
    marginTop: 0.5,
  },
  bulletText: {
    flex: 1,
    fontSize: FONT.body,
    color: COLORS.textSoft,
    lineHeight: 1.45,
  },

  /* Education */
  educationItem: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.border,
    paddingLeft: 10,
    marginBottom: SPACING.md,
  },
  degreeText: {
    fontSize: FONT.h3,
    fontWeight: 700,
    color: COLORS.text,
    marginBottom: 2,
  },
  fieldText: {
    fontSize: FONT.body,
    color: COLORS.textSoft,
    marginBottom: 2,
  },
  schoolText: {
    fontSize: 10,
    fontWeight: 700,
    color: COLORS.company,
    marginBottom: 4,
  },
});

/* =========================
   Sub Components
========================= */
function SidebarSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sidebarSectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ContentSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionBlock}>
      <View style={styles.contentSectionHeader}>
        <Text style={styles.contentSectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

/* =========================
   Main Document
========================= */
export function CVDocument({ candidate }: CVDocumentProps) {
  const fullName = getFullName(candidate);
  const contactLines = getContactLines(candidate);
  const competencies = getCoreCompetencies(candidate.targetJobRole);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Sidebar */}
        <View style={styles.sidebar}>
          <View style={styles.profileSection}>
            {candidate.avatarUrl ? (
              <Image src={candidate.avatarUrl} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder} />
            )}

            <Text style={styles.availabilityBadge}>AVAILABLE</Text>
            <Text style={styles.fullName}>{fullName}</Text>

            {candidate.targetJobRole && (
              <Text style={styles.targetRole}>{candidate.targetJobRole.replace(/_/g, " ")}</Text>
            )}

            <View style={styles.divider} />

            {contactLines.map((line, index) => (
              <Text key={`${line}-${index}`} style={styles.contactItem}>
                {line}
              </Text>
            ))}
          </View>

          {candidate.skills.length > 0 && (
            <SidebarSection title="Technical Skills">
              <View style={styles.skillsWrap}>
                {candidate.skills.map((skill) => (
                  <Text key={skill.id} style={styles.skillTag}>
                    {skill.name}
                  </Text>
                ))}
              </View>
            </SidebarSection>
          )}

          <SidebarSection title="Core Competencies">
            {competencies.map((competency, index) => (
              <View key={`${competency}-${index}`} style={styles.competencyRow}>
                <Text style={styles.competencyBullet}>•</Text>
                <Text style={styles.competencyText}>{competency}</Text>
              </View>
            ))}
          </SidebarSection>

          {candidate.languages.length > 0 && (
            <SidebarSection title="Languages">
              {candidate.languages.map((language) => {
                const percent = getProficiencyPercent(language.proficiency);

                return (
                  <View key={language.id} style={styles.languageItem}>
                    <View style={styles.languageHeader}>
                      <Text style={styles.languageName}>{language.name}</Text>
                      <Text style={styles.languageLevel}>{language.proficiency}</Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${percent}%` }]} />
                    </View>
                  </View>
                );
              })}
            </SidebarSection>
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {candidate.summary && (
            <View style={styles.summaryWrapper}>
              <ContentSection title="Professional Summary">
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryText}>{candidate.summary}</Text>
                </View>
              </ContentSection>
            </View>
          )}

          {candidate.experiences.length > 0 && (
            <View style={styles.experienceSection}>
              <ContentSection title="Work Experience">
                {candidate.experiences.map((exp, index) => {
                  const bullets = parseDescription(exp.description);
                  const metaLine = [exp.location].filter(Boolean).join(" • ");

                  return (
                    <View key={exp.id} style={styles.timelineItem} wrap={false}>
                      <View style={index === 0 ? styles.timelineDotActive : styles.timelineDot} />
                      {index !== candidate.experiences.length - 1 && <View style={styles.timelineLine} />}

                      <View style={styles.itemHeader}>
                        <View style={styles.itemHeaderLeft}>
                          <Text style={styles.jobTitle}>{exp.title}</Text>
                          <Text style={styles.companyText}>{exp.company}</Text>
                          {!!metaLine && <Text style={styles.itemMeta}>{metaLine}</Text>}
                        </View>

                        <Text style={styles.dateBadge}>
                          {formatDateRange(exp.startDate, exp.endDate, exp.isCurrent)}
                        </Text>
                      </View>

                      {bullets.map((bullet, bulletIndex) => (
                        <View key={`${exp.id}-bullet-${bulletIndex}`} style={styles.bulletRow}>
                          <Text style={styles.bulletIcon}>✓</Text>
                          <Text style={styles.bulletText}>{bullet}</Text>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </ContentSection>
            </View>
          )}

          {candidate.education.length > 0 && (
            <ContentSection title="Education">
              {candidate.education.map((edu) => (
                <View key={edu.id} style={styles.educationItem} wrap={false}>
                  <Text style={styles.degreeText}>{edu.degree}</Text>
                  {edu.fieldOfStudy && <Text style={styles.fieldText}>{edu.fieldOfStudy}</Text>}
                  <Text style={styles.schoolText}>{edu.school}</Text>
                  <Text style={styles.dateBadge}>
                    {formatDateRange(edu.startDate, edu.endDate, edu.isCurrent)}
                  </Text>
                </View>
              ))}
            </ContentSection>
          )}
        </View>
      </Page>
    </Document>
  );
}