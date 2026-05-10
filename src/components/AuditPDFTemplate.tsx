import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  pdf,
  Svg,
  Path,
} from "@react-pdf/renderer";
import type { AuditReport, SocialPlatformReport, CompetitorProfile } from "@/lib/auditModel";
import {
  getScoreBand,
  HEALTH_BAR_SEGMENTS,
  SCORE_COLORS,
  SCORE_LEGEND,
} from "@/lib/scoring";

const KNOWN_PLATFORMS = new Set([
  "linkedin", "twitter", "x", "facebook", "instagram",
  "youtube", "tiktok", "pinterest", "github", "threads",
  "reddit", "medium", "glassdoor", "crunchbase", "snapchat",
]);

// Brand palette (non-score colors live here; score colors come from scoring module)
const colors = {
  navy: "#25394b",
  yellow: SCORE_COLORS.orange,
  green: SCORE_COLORS.green,
  red: SCORE_COLORS.red,
  grey: "#7c8287",
  lightGrey: "#e5e5e5",
  white: "#ffffff",
  black: "#1a1a1a",
};

// Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 11,
    color: colors.black,
    backgroundColor: colors.white,
  },
  // Cover page
  coverPage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  logo: {
    width: 180,
    marginBottom: 40,
  },
  coverTitle: {
    fontSize: 32,
    fontFamily: "Helvetica-Bold",
    color: colors.navy,
    marginBottom: 16,
    textAlign: "center",
  },
  coverSubtitle: {
    fontSize: 16,
    color: colors.grey,
    textAlign: "center",
  },
  // Section headers
  sectionHeader: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: colors.navy,
    marginBottom: 16,
    paddingBottom: 6,
    borderBottomWidth: 3,
    borderBottomColor: colors.yellow,
  },
  // Individual item
  itemContainer: {
    marginBottom: 14,
  },
  itemTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: colors.black,
    marginBottom: 6,
  },
  // Score row
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  scoreLabel: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginRight: 8,
  },
  starsContainer: {
    flexDirection: "row",
  },
  star: {
    fontSize: 14,
    marginRight: 2,
  },
  // Indicator row
  indicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  indicatorLabel: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginRight: 8,
  },
  indicatorCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  indicatorText: {
    fontSize: 11,
  },
  // Content sections
  contentHeader: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 3,
    marginTop: 4,
  },
  contentText: {
    fontSize: 10,
    lineHeight: 1.5,
    color: colors.black,
    marginBottom: 4,
  },
  bulletList: {
    marginLeft: 12,
    marginBottom: 4,
  },
  bulletItem: {
    fontSize: 10,
    lineHeight: 1.5,
    marginBottom: 1,
  },
  // Divider
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGrey,
    marginTop: 8,
    marginBottom: 8,
  },
  // 90-day plan
  planSection: {
    marginBottom: 10,
  },
  planTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: colors.navy,
    marginBottom: 8,
  },
  // Page number
  pageNumber: {
    position: "absolute",
    bottom: 20,
    right: 40,
    fontSize: 10,
    color: colors.grey,
  },
  // How to Read Scores styles
  howToReadTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: colors.navy,
    marginBottom: 4,
  },
  howToReadSubtitle: {
    fontSize: 9,
    color: colors.grey,
    marginBottom: 12,
  },
  scoreCardsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  scoreCard: {
    width: "31%",
    borderWidth: 1.5,
    borderRadius: 6,
    padding: 10,
  },
  scoreCardTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: colors.navy,
    marginBottom: 6,
  },
  scoreCardStars: {
    flexDirection: "row",
    marginBottom: 6,
  },
  scoreCardRange: {
    fontSize: 8,
    color: colors.grey,
    marginBottom: 4,
  },
  scoreCardDescription: {
    fontSize: 8,
    color: colors.black,
    lineHeight: 1.4,
  },
  healthScaleContainer: {
    borderWidth: 1,
    borderColor: colors.lightGrey,
    borderRadius: 6,
    padding: 12,
    marginTop: 8,
  },
  healthScaleTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: colors.navy,
    textAlign: "center",
    marginBottom: 10,
  },
  healthScaleBar: {
    flexDirection: "row",
    height: 12,
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 12,
  },
  healthScaleLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  healthScaleLabelItem: {
    alignItems: "center",
    width: "20%",
  },
  healthScaleLabelScore: {
    fontSize: 8,
    color: colors.grey,
    marginBottom: 1,
  },
  healthScaleLabelText: {
    fontSize: 7,
    color: colors.black,
  },
});

// Star SVG path for a 5-pointed star
const StarIcon = ({ filled, color, size = 14 }: { filled: boolean; color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      fill={filled ? color : colors.lightGrey}
    />
  </Svg>
);

// Stars component - using SVG stars
const Stars = ({ score }: { score: number }) => {
  const band = getScoreBand(score);
  return (
    <View style={styles.starsContainer}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={{ marginRight: 2 }}>
          <StarIcon filled={i <= band.stars} color={band.color} />
        </View>
      ))}
      <Text style={{ marginLeft: 8, fontSize: 11, color: colors.grey }}>
        ({score}/100)
      </Text>
    </View>
  );
};

// Indicator component
const Indicator = ({ score }: { score: number }) => {
  const band = getScoreBand(score);
  return (
    <View style={styles.indicatorRow}>
      <Text style={styles.indicatorLabel}>Indicator:</Text>
      <View style={[styles.indicatorCircle, { backgroundColor: band.color }]} />
      <Text style={styles.indicatorText}>{band.label}</Text>
    </View>
  );
};

// Score display component
const ScoreDisplay = ({ score }: { score: number }) => (
  <>
    <View style={styles.scoreRow}>
      <Text style={styles.scoreLabel}>Score:</Text>
      <Stars score={score} />
    </View>
    <Indicator score={score} />
  </>
);

// Bullet list component
const BulletList = ({ items }: { items: string[] }) => (
  <View style={styles.bulletList}>
    {items.map((item, idx) => (
      <Text key={idx} style={styles.bulletItem}>
        • {item}
      </Text>
    ))}
  </View>
);

// Cover Page with How to Read Your Scores
const CoverPage = ({ companyName, createdAt }: { companyName: string; createdAt?: string }) => (
  <Page size="A4" style={[styles.page, { justifyContent: "space-between" }]}>
    {/* Header with logo and title */}
    <View style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
      <Image src="/Enid_Wordmark_Full_Color.png" style={{ width: 160, marginBottom: 20 }} />
      <Text style={styles.coverTitle}>{companyName}</Text>
      <Text style={styles.coverSubtitle}>Company Audit by Enid</Text>
      {createdAt && (
        <Text style={{ fontSize: 12, color: colors.grey, marginTop: 8 }}>
          {new Date(createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
        </Text>
      )}
    </View>
    
    {/* How to Read Your Scores Section - at the bottom */}
    <View>
    <Text style={styles.howToReadTitle}>How to Read Your Scores</Text>
    <Text style={styles.howToReadSubtitle}>Understanding your brand health metrics</Text>
    
    {/* Three score category cards */}
    <View style={styles.scoreCardsRow}>
      {SCORE_LEGEND.map((card) => (
        <View key={card.id} style={[styles.scoreCard, { borderColor: card.color }]}>
          <Text style={styles.scoreCardTitle}>{card.title}</Text>
          <View style={styles.scoreCardStars}>
            {[1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={{ marginRight: 1 }}>
                <StarIcon filled={i <= card.filledStars} color={card.color} size={10} />
              </View>
            ))}
          </View>
          <Text style={styles.scoreCardRange}>Stars: {card.starsRange}</Text>
          <Text style={styles.scoreCardDescription}>{card.description}</Text>
        </View>
      ))}
    </View>

    {/* Brand Health Scale */}
    <View style={styles.healthScaleContainer}>
      <Text style={styles.healthScaleTitle}>Brand Health Scale</Text>

      {/* Gradient bar */}
      <View style={styles.healthScaleBar}>
        {HEALTH_BAR_SEGMENTS.map((seg, idx) => (
          <View key={idx} style={{ flex: 1, backgroundColor: seg.color }} />
        ))}
      </View>

      {/* Labels */}
      <View style={styles.healthScaleLabels}>
        {HEALTH_BAR_SEGMENTS.map((seg, idx) => (
          <View key={idx} style={styles.healthScaleLabelItem}>
            <Text style={styles.healthScaleLabelScore}>{seg.scoreRange}</Text>
            <Text style={styles.healthScaleLabelText}>{seg.label}</Text>
          </View>
        ))}
      </View>
    </View>
    </View>
  </Page>
);

// Tier badge
const TierBadge = ({ tier }: { tier: 1 | 2 }) => (
  <View
    style={{
      backgroundColor: tier === 1 ? "#8a6f9b" : "#26394a",
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      alignSelf: "flex-start",
      marginBottom: 4,
    }}
  >
    <Text style={{ fontSize: 7, color: colors.white, fontFamily: "Helvetica-Bold" }}>
      TIER {tier}
    </Text>
  </View>
);

// Brand Section Item - wrap={false} keeps each section together, avoiding mid-section breaks
const BrandSectionItem = ({
  number,
  title,
  assessment,
  opportunities,
  score,
  tier = 1,
}: {
  number: number;
  title: string;
  assessment: string;
  opportunities?: string[];
  score: number;
  tier?: 1 | 2;
}) => (
  <View style={styles.itemContainer} wrap={false}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <Text style={[styles.itemTitle, { marginBottom: 0 }]}>
        {number}. {title}
      </Text>
      <TierBadge tier={tier} />
    </View>
    <ScoreDisplay score={score} />
    <Text style={styles.contentHeader}>Assessment</Text>
    <Text style={styles.contentText}>{assessment}</Text>
    {opportunities && opportunities.length > 0 && (
      <>
        <Text style={styles.contentHeader}>Opportunities</Text>
        <BulletList items={opportunities} />
      </>
    )}
    <View style={styles.divider} />
  </View>
);

// Website Section Item - wrap={false} keeps each section together, avoiding mid-section breaks
const WebsiteSectionItem = ({
  number,
  title,
  assessment,
  whatsWorking,
  whatsNeedsAttention,
  keyTakeaway,
  score,
  tier = 1,
}: {
  number: number;
  title: string;
  assessment: string;
  whatsWorking?: string[];
  whatsNeedsAttention?: string[];
  keyTakeaway?: string;
  score: number;
  tier?: 1 | 2;
}) => (
  <View style={styles.itemContainer} wrap={false}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <Text style={[styles.itemTitle, { marginBottom: 0 }]}>
        {number}. {title}
      </Text>
      <TierBadge tier={tier} />
    </View>
    <ScoreDisplay score={score} />
    <Text style={styles.contentHeader}>Assessment</Text>
    <Text style={styles.contentText}>{assessment}</Text>
    {keyTakeaway && (
      <>
        <Text style={styles.contentHeader}>Key Takeaway</Text>
        <Text style={styles.contentText}>{keyTakeaway}</Text>
      </>
    )}
    {whatsWorking && whatsWorking.length > 0 && (
      <>
        <Text style={styles.contentHeader}>What's Working</Text>
        <BulletList items={whatsWorking} />
      </>
    )}
    {whatsNeedsAttention && whatsNeedsAttention.length > 0 && (
      <>
        <Text style={styles.contentHeader}>What Needs Attention</Text>
        <BulletList items={whatsNeedsAttention} />
      </>
    )}
    <View style={styles.divider} />
  </View>
);

// 90-Day Plan Section
const NinetyDayPlan = ({
  plans,
}: {
  plans: Array<Record<string, string[]>>;
}) => (
  <View>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <Text style={[styles.itemTitle, { marginBottom: 0 }]}>90-Day Brand Game Plan</Text>
      <TierBadge tier={2} />
    </View>
    {plans.map((plan, idx) => {
      const title = Object.keys(plan)[0];
      const items = plan[title] || [];
      return (
        <View key={idx} style={styles.planSection}>
          <Text style={styles.planTitle}>{title}</Text>
          <BulletList items={items} />
        </View>
      );
    })}
  </View>
);

// Social Media Platform Section Item
const SocialPlatformItem = ({
  platform,
  data,
}: {
  platform: string;
  data: SocialPlatformReport;
}) => {
  const categories = [
    { label: "Profile Completeness", d: data.profileCompleteness },
    { label: "Content Quality", d: data.contentQuality },
    { label: "Brand Alignment", d: data.brandAlignment },
    { label: "Audience Engagement", d: data.audienceEngagement },
    { label: "Posting Frequency", d: data.postingFrequency },
    { label: "Visual Consistency", d: data.visualConsistency },
  ];

  return (
    <View style={styles.itemContainer}>
      <Text style={styles.itemTitle}>{platform}</Text>
      <ScoreDisplay score={data.platformAverage} />

      {categories.map((cat, idx) => (
        <View key={idx} style={{ marginBottom: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
            <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", marginRight: 4 }}>
              {cat.label}:
            </Text>
            <Text style={{ fontSize: 10, color: colors.grey }}>{cat.d.score}/100</Text>
          </View>
          <Text style={styles.contentText}>{cat.d.assessment}</Text>
        </View>
      ))}

      {data.strengths.length > 0 && (
        <>
          <Text style={[styles.contentHeader, { color: colors.green }]}>Strengths</Text>
          <BulletList items={data.strengths} />
        </>
      )}
      {data.weaknesses.length > 0 && (
        <>
          <Text style={[styles.contentHeader, { color: colors.red }]}>Weaknesses</Text>
          <BulletList items={data.weaknesses} />
        </>
      )}
      {data.recommendations.length > 0 && (
        <>
          <Text style={[styles.contentHeader, { color: colors.navy }]}>Recommendations</Text>
          <BulletList items={data.recommendations} />
        </>
      )}
      <View style={styles.divider} />
    </View>
  );
};

// Social Cross-Platform Item (kept for potential future use)
const _SocialCrossItem = ({
  number,
  title,
  assessment,
  score,
}: {
  number: number;
  title: string;
  assessment: string;
  score: number;
}) => (
  <View style={styles.itemContainer}>
    <Text style={styles.itemTitle}>
      {number}. {title}
    </Text>
    <ScoreDisplay score={score} />
    <Text style={styles.contentHeader}>Assessment</Text>
    <Text style={styles.contentText}>{assessment}</Text>
    <View style={styles.divider} />
  </View>
);

// Competitor Profile Item
const CompetitorItem = ({ comp }: { comp: CompetitorProfile }) => {
  const advantages = comp.advantage
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  const disadvantages = comp.disadvantage
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  const typeLabel =
    comp.competitorType === "global"
      ? "Global"
      : comp.competitorType === "national"
        ? "National"
        : "Local";

  const typeColor =
    comp.competitorType === "global"
      ? colors.green
      : comp.competitorType === "national"
        ? colors.yellow
        : colors.navy;

  return (
    <View style={styles.itemContainer} wrap={false}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        <Text style={[styles.itemTitle, { marginBottom: 0, flex: 1 }]}>{comp.companyName}</Text>
        <View
          style={{
            backgroundColor: typeColor,
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 2,
          }}
        >
          <Text style={{ fontSize: 8, color: colors.white, fontFamily: "Helvetica-Bold" }}>
            {typeLabel}
          </Text>
        </View>
      </View>

      {comp.overview ? (
        <Text style={styles.contentText}>{comp.overview}</Text>
      ) : null}

      {/* Company details */}
      <View style={{ marginBottom: 8 }}>
        {[
          { label: "Website", value: comp.companyUrl },
          { label: "Size", value: comp.size },
          { label: "Location", value: comp.location },
          { label: "Established", value: comp.establishedDate },
        ]
          .filter((r) => r.value)
          .map((r) => (
            <View key={r.label} style={{ flexDirection: "row", marginBottom: 2 }}>
              <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", width: 80 }}>
                {r.label}:
              </Text>
              <Text style={{ fontSize: 10, color: colors.black, flex: 1 }}>{r.value}</Text>
            </View>
          ))}
      </View>

      {comp.leadership.length > 0 && (
        <>
          <Text style={styles.contentHeader}>Leadership</Text>
          <BulletList
            items={comp.leadership.map((l) => `${l.name} — ${l.title}`)}
          />
        </>
      )}

      {advantages.length > 0 && (
        <>
          <Text style={[styles.contentHeader, { color: colors.green }]}>Advantages</Text>
          <BulletList items={advantages} />
        </>
      )}

      {disadvantages.length > 0 && (
        <>
          <Text style={[styles.contentHeader, { color: colors.red }]}>Disadvantages</Text>
          <BulletList items={disadvantages} />
        </>
      )}

      {comp.socialLinks.length > 0 && (
        <>
          <Text style={styles.contentHeader}>Social Profiles</Text>
          <BulletList items={comp.socialLinks} />
        </>
      )}

      <View style={styles.divider} />
    </View>
  );
};

// Main PDF Document - Using automatic page breaks for natural content flow
const AuditPDFDocument = ({ audit }: { audit: AuditReport }) => {
  const { brandReport, websiteReport, brandScores, websiteScores, companyName } =
    audit;
  const sm = audit.socialMediaReport;
  const cr = audit.competitorReport;

  return (
    <Document>
      {/* Cover Page with How to Read Your Scores */}
      <CoverPage companyName={companyName} createdAt={audit.createdAt} />

      {/* Brand Audit - All sections in one page, content flows naturally */}
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.sectionHeader}>BRAND AUDIT</Text>

        <BrandSectionItem
          number={1}
          title="Brand Overview"
          assessment={brandReport.brandOverview?.assessment || ""}
          score={brandScores.brandOverview}
        />

        <BrandSectionItem
          number={2}
          title="Who You Are"
          assessment={brandReport.whoYouAre?.assessment || ""}
          opportunities={brandReport.whoYouAre?.opportunity}
          score={brandScores.whoYouAre}
        />

        <BrandSectionItem
          number={3}
          title="How You Look"
          assessment={brandReport.howYouLook?.assessment || ""}
          opportunities={brandReport.howYouLook?.opportunity}
          score={brandScores.howYouLook}
        />

        <BrandSectionItem
          number={4}
          title="How You Sound"
          assessment={brandReport.howYouSound?.assessment || ""}
          opportunities={brandReport.howYouSound?.opportunity}
          score={brandScores.howYouSound}
        />

        <BrandSectionItem
          number={5}
          title="Who You Serve"
          assessment={brandReport.whoYouServe?.assessment || ""}
          opportunities={brandReport.whoYouServe?.opportunity}
          score={brandScores.whoYouServe}
        />

        <BrandSectionItem
          number={6}
          title="Position & Market Fit"
          assessment={brandReport.positionAndMarketFit?.assessment || ""}
          opportunities={brandReport.positionAndMarketFit?.opportunity}
          score={brandScores.positionAndMarketFit}
          tier={2}
        />

        {/* Brand Health Summary */}
        <View style={styles.itemContainer} wrap={false}>
          <Text style={styles.itemTitle}>Brand Health Summary</Text>
          <Text style={styles.contentText}>{brandReport.brandHealth || ""}</Text>
        </View>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>

      {/* 90-Day Brand Game Plan - dedicated page */}
      {brandReport.ninetyDayPlanSummary &&
        brandReport.ninetyDayPlanSummary.length > 0 && (
        <Page size="A4" style={styles.page} wrap>
          <NinetyDayPlan plans={brandReport.ninetyDayPlanSummary} />
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
            fixed
          />
        </Page>
      )}

      {/* Website Audit - All sections in one page, content flows naturally */}
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.sectionHeader}>WEBSITE AUDIT</Text>

        <WebsiteSectionItem
          number={1}
          title="Website Overview"
          assessment={websiteReport.websiteOverview?.assessment || ""}
          keyTakeaway={websiteReport.websiteOverview?.keyTakeaway}
          score={websiteScores.websiteOverview}
        />

        <WebsiteSectionItem
          number={2}
          title="Brand Expression"
          assessment={websiteReport.brandExpression?.assessment || ""}
          whatsWorking={websiteReport.brandExpression?.whatsWorking}
          whatsNeedsAttention={websiteReport.brandExpression?.whatsNeedsAttention}
          score={websiteScores.brandExpression}
        />

        <WebsiteSectionItem
          number={3}
          title="Messaging & Clarity"
          assessment={websiteReport.messagingAndClarity?.assessment || ""}
          whatsWorking={websiteReport.messagingAndClarity?.whatsWorking}
          whatsNeedsAttention={
            websiteReport.messagingAndClarity?.whatsNeedsAttention
          }
          score={websiteScores.messagingAndClarity}
          tier={2}
        />

        <WebsiteSectionItem
          number={4}
          title="UX & Navigation"
          assessment={websiteReport.uxAndNavigation?.assessment || ""}
          whatsWorking={websiteReport.uxAndNavigation?.whatsWorking}
          whatsNeedsAttention={websiteReport.uxAndNavigation?.whatsNeedsAttention}
          score={websiteScores.uxAndNavigation}
        />

        <WebsiteSectionItem
          number={5}
          title="Readability & Inclusivity"
          assessment={websiteReport.accessibility?.assessment || ""}
          whatsWorking={websiteReport.accessibility?.whatsWorking}
          whatsNeedsAttention={websiteReport.accessibility?.whatsNeedsAttention}
          score={websiteScores.accessibility}
        />

        <WebsiteSectionItem
          number={6}
          title="CTAs, Trust & Conversion"
          assessment={websiteReport.ctasTrustConversion?.assessment || ""}
          whatsWorking={websiteReport.ctasTrustConversion?.whatsWorking}
          whatsNeedsAttention={
            websiteReport.ctasTrustConversion?.whatsNeedsAttention
          }
          score={websiteScores.ctasTrustConversion}
        />

        <WebsiteSectionItem
          number={7}
          title="Social Consistency"
          assessment={websiteReport.socialConsistency?.assessment || ""}
          whatsWorking={websiteReport.socialConsistency?.whatsWorking}
          whatsNeedsAttention={
            websiteReport.socialConsistency?.whatsNeedsAttention
          }
          score={websiteScores.socialConsistency}
        />

        <WebsiteSectionItem
          number={8}
          title="Risk & Confidence Framing"
          assessment={websiteReport.riskAndConfidenceFraming?.assessment || ""}
          whatsWorking={websiteReport.riskAndConfidenceFraming?.whatsWorking}
          whatsNeedsAttention={
            websiteReport.riskAndConfidenceFraming?.whatsNeedsAttention
          }
          score={websiteScores.riskAndConfidenceFraming}
        />

        {/* Final Synthesis */}
        <View style={styles.itemContainer}>
          <Text style={styles.itemTitle}>What's Working Overall</Text>
          <BulletList
            items={websiteReport.finalSynthesis?.whatsWorkingOverall || []}
          />
        </View>

        <View style={styles.itemContainer}>
          <Text style={styles.itemTitle}>What Needs Attention Overall</Text>
          <BulletList
            items={websiteReport.finalSynthesis?.whatsNeedsAttentionOverall || []}
          />
        </View>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>

      {/* Social Media Audit (conditional) */}
      {sm && (
        <>
          {/* Social overview */}
          <Page size="A4" style={styles.page}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16, paddingBottom: 6, borderBottomWidth: 3, borderBottomColor: colors.yellow }}>
              <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", color: colors.navy }}>SOCIAL MEDIA AUDIT</Text>
              <TierBadge tier={2} />
            </View>

            <View style={styles.itemContainer}>
              <Text style={styles.itemTitle}>Overall Social Media Score</Text>
              <ScoreDisplay score={sm.overallScore} />
              <Text style={{ fontSize: 10, color: colors.grey, marginTop: 4 }}>
                Platforms analyzed: {sm.platformsAnalyzed.join(", ")}
              </Text>
              <View style={styles.divider} />
            </View>

{/* Cross-platform evaluation */}
{(() => {
              // Parse overallEvaluation if it's a JSON string
              let parsed: any = null;
              if (sm.overallEvaluation) {
                try {
                  parsed = typeof sm.overallEvaluation === "string"
                    ? JSON.parse(sm.overallEvaluation)
                    : sm.overallEvaluation;
                } catch {
                  parsed = null;
                }
              }

              const crossScores = parsed?.cross_platform_scores;
              const assessment = parsed?.overall_assessment;
              const narrative = parsed?.executive_narrative;
              const actionPlan = parsed?.ninety_day_action_plan;

              return (
                <>
                  {/* Cross-Platform Scores */}
                  {crossScores && (
                    <View style={styles.itemContainer}>
                      <Text style={styles.itemTitle}>Cross-Platform Scores</Text>
                      {Object.entries(crossScores).map(([label, data]: [string, any]) => (
                        <View key={label} style={{ marginBottom: 6 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                            <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", marginRight: 4 }}>
                              {label}:
                            </Text>
                            <Text style={{ fontSize: 10, color: colors.grey }}>{data.score}/100</Text>
                          </View>
                          <Text style={styles.contentText}>{data.assessment}</Text>
                        </View>
                      ))}
                      <View style={styles.divider} />
                    </View>
                  )}

                  {/* Key Strengths / Critical Gaps / Missing Opportunities */}
                  {assessment && (
                    <View style={styles.itemContainer}>
                      <Text style={styles.itemTitle}>Overall Assessment</Text>
                      {assessment.key_strengths?.length > 0 && (
                        <>
                          <Text style={[styles.contentHeader, { color: colors.green }]}>Key Strengths</Text>
                          <BulletList items={assessment.key_strengths} />
                        </>
                      )}
                      {assessment.critical_gaps?.length > 0 && (
                        <>
                          <Text style={[styles.contentHeader, { color: colors.red }]}>Critical Gaps</Text>
                          <BulletList items={assessment.critical_gaps} />
                        </>
                      )}
                      {assessment.missing_opportunities?.length > 0 && (
                        <>
                          <Text style={[styles.contentHeader, { color: colors.navy }]}>Missing Opportunities</Text>
                          <BulletList items={assessment.missing_opportunities} />
                        </>
                      )}
                      {(() => {
                        const validPriority = (assessment.platform_priority_ranking ?? [])
                          .filter((e: any) => KNOWN_PLATFORMS.has(String(e.platform).trim().toLowerCase()));
                        if (validPriority.length === 0) return null;
                        return (
                          <>
                            <Text style={[styles.contentHeader, { color: colors.navy }]}>Platform Priority</Text>
                            {validPriority.map((entry: any, idx: number) => (
                              <Text key={entry.platform} style={styles.bulletItem}>
                                • #{idx + 1} {entry.platform} — {entry.rationale}
                              </Text>
                            ))}
                          </>
                        );
                      })()}
                      <View style={styles.divider} />
                    </View>
                  )}

                  {/* Executive Narrative */}
                  {narrative && (
                    <View style={styles.itemContainer}>
                      <Text style={styles.itemTitle}>Executive Summary</Text>
                      {narrative.presence_health && (
                        <>
                          <Text style={styles.contentHeader}>Presence Health</Text>
                          <Text style={styles.contentText}>{narrative.presence_health}</Text>
                        </>
                      )}
                      {narrative.consistency_analysis && (
                        <>
                          <Text style={styles.contentHeader}>Consistency</Text>
                          <Text style={styles.contentText}>{narrative.consistency_analysis}</Text>
                        </>
                      )}
                      {narrative.resource_allocation && (
                        <>
                          <Text style={styles.contentHeader}>Resource Allocation</Text>
                          <Text style={styles.contentText}>{narrative.resource_allocation}</Text>
                        </>
                      )}
                      <View style={styles.divider} />
                    </View>
                  )}

                  {/* 90-Day Action Plan */}
                  {actionPlan?.length > 0 && (
                    <View style={styles.itemContainer}>
                      <Text style={styles.itemTitle}>90-Day Action Plan</Text>
                      {actionPlan.map((initiative: any, i: number) => (
                        <View key={i} style={styles.planSection}>
                          <Text style={styles.planTitle}>{initiative.initiative_title}</Text>
                          <BulletList items={initiative.actions} />
                        </View>
                      ))}
                      <View style={styles.divider} />
                    </View>
                  )}

                  {/* Fallback: plain string */}
                  {!parsed && sm.overallEvaluation && (
                    <View style={styles.itemContainer}>
                      <Text style={styles.itemTitle}>Cross-Platform Analysis</Text>
                      <Text style={styles.contentText}>{sm.overallEvaluation}</Text>
                      <View style={styles.divider} />
                    </View>
                  )}
                </>
              );
            })()}
          </Page>

          {/* One page per platform */}
          {sm.platformsAnalyzed.map((platform) => {
            const p = sm.platformScores[platform];
            if (!p) return null;
            return (
              <Page key={platform} size="A4" style={styles.page}>
                <Text style={[styles.sectionHeader, { borderBottomColor: colors.lightGrey, borderBottomWidth: 1 }]}>{platform.toUpperCase()}</Text>
                <SocialPlatformItem platform={platform} data={p} />
                <Text
                  style={styles.pageNumber}
                  render={({ pageNumber, totalPages }) =>
                    `${pageNumber} / ${totalPages}`
                  }
                  fixed
                />
              </Page>
            );
          })}
        </>
      )}

      {/* Competitor Research (conditional) */}
      {cr && cr.competitors.length > 0 && (
        <Page size="A4" style={styles.page} wrap>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16, paddingBottom: 6, borderBottomWidth: 3, borderBottomColor: colors.yellow }}>
            <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", color: colors.navy }}>COMPETITOR RESEARCH</Text>
            <TierBadge tier={2} />
          </View>

          {/* Landscape summary */}
          <View style={styles.itemContainer}>
            <Text style={styles.itemTitle}>Competitor Landscape</Text>
            <Text style={styles.contentText}>
              {cr.landscapeSummary ||
                `We identified ${cr.competitors.length} competitor${cr.competitors.length !== 1 ? "s" : ""} operating in your space.`}
            </Text>
            <Text style={{ fontSize: 10, color: colors.grey, marginTop: 4 }}>
              Competitors analyzed: {cr.competitorsAnalyzed.join(", ")}
            </Text>
            <View style={styles.divider} />
          </View>

          {/* Individual competitor profiles */}
          {cr.competitors.map((comp) => (
            <CompetitorItem key={comp.companyUrl} comp={comp} />
          ))}

          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
            fixed
          />
        </Page>
      )}
    </Document>
  );
};

// Function to generate and download PDF
export async function generateAuditPDF(audit: AuditReport): Promise<void> {
  const blob = await pdf(<AuditPDFDocument audit={audit} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${audit.companyName} Audit by Enid.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export { AuditPDFDocument };
