/**
 * SnapshotPDFTemplate
 *
 * React-PDF document component for generating Brand Snapshot PDF reports.
 * Used server-side by the snapshot PDF API route — do NOT add "use client".
 *
 * Exports:
 *  - Types: SnapshotLeak, SnapshotFixAction, SnapshotResult, SeoVisibility, SnapshotPDFData
 *  - Component: SnapshotDocument (the root <Document> to pass to pdf())
 */

import React from "react";
import path from "path";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Svg,
  Path,
  Font,
  Link,
} from "@react-pdf/renderer";
import { getScoreBand, SCORE_COLORS } from "@/lib/scoring";

// ---------------------------------------------------------------------------
// Poppins font registration (local files in public/fonts/)
// ---------------------------------------------------------------------------

const fontsDir = path.join(process.cwd(), "public", "fonts");

Font.register({
  family: "Poppins",
  fonts: [
    {
      src: path.join(fontsDir, "Poppins-Regular.ttf"),
      fontWeight: 400,
    },
    {
      src: path.join(fontsDir, "Poppins-Bold.ttf"),
      fontWeight: 700,
    },
    {
      src: path.join(fontsDir, "Poppins-Italic.ttf"),
      fontWeight: 400,
      fontStyle: "italic",
    },
  ],
});

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingLeft: 40,
    paddingRight: 40,
    paddingBottom: 60,
    fontFamily: "Poppins",
    fontSize: 11,
    color: colors.black,
    backgroundColor: colors.white,
  },
  sectionHeader: {
    fontSize: 13,
    fontFamily: "Poppins",
    fontWeight: 700,
    color: colors.navy,
    marginBottom: 10,
    paddingBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: colors.yellow,
  },
  itemTitle: {
    fontSize: 14,
    fontFamily: "Poppins",
    fontWeight: 700,
    color: colors.black,
    marginBottom: 6,
  },
  contentHeader: {
    fontSize: 11,
    fontFamily: "Poppins",
    fontWeight: 700,
    marginBottom: 3,
    marginTop: 4,
  },
  contentText: {
    fontSize: 10,
    lineHeight: 1.5,
    color: colors.black,
    marginBottom: 4,
  },
  bulletItem: {
    fontSize: 10,
    lineHeight: 1.5,
    marginBottom: 1,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGrey,
    marginTop: 8,
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: "row",
  },
});

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

/** A single brand value leak entry ranked 1–5. */
export interface SnapshotLeak {
  rank: number;
  issue: string;
  impact: string;
}

/** A single prioritised fix action. */
export interface SnapshotFixAction {
  priority: number;
  action: string;
}

/** The structured snapshot result returned by the AI agent. */
export interface SnapshotResult {
  what_enid_found: string;
  top_5_brand_value_leaks: SnapshotLeak[];
  brand_signal_snapshot: string;
  website_signal_snapshot: string;
  visibility_snapshot: string;
  what_to_fix_first: SnapshotFixAction[];
  recommended_next_step: string;
}

/** SEO / visibility presence flags. */
export interface SeoVisibility {
  websiteVisible: boolean;
  socialVisible: boolean;
  pressVisible: boolean;
  visibilityScore: "Strong" | "Moderate" | "Weak";
}

/** All data the SnapshotDocument component needs to render the PDF. */
export interface SnapshotPDFData {
  companyName: string;
  companyUrl: string;
  createdAt: string;
  enidScore: number;
  seoVisibility: SeoVisibility;
  snapshot: SnapshotResult;
  /** Absolute file path on the server (process.cwd()/public/...). */
  logoSrc: string;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const StarIcon = ({
  filled,
  color,
  size = 14,
}: {
  filled: boolean;
  color: string;
  size?: number;
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      fill={filled ? color : colors.lightGrey}
    />
  </Svg>
);

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

// ---------------------------------------------------------------------------
// Fixed page footer (appears on every content page)
// ---------------------------------------------------------------------------

const PageFooter = () => (
  <View
    fixed
    style={{
      position: "absolute",
      bottom: 16,
      left: 40,
      right: 40,
      borderTopWidth: 1,
      borderTopColor: colors.lightGrey,
      paddingTop: 6,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    }}
  >
    <Text style={{ fontSize: 7, color: colors.grey, fontFamily: "Poppins", fontWeight: 400 }}>
      Prepared by Enid, a Brand Intelligence system by DLB Creative{"  "}dlb-creative.com | askenid.ai | hello@dlb-creative.com
    </Text>
    <Text
      style={{ fontSize: 7, color: colors.grey }}
      render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
    />
  </View>
);

// ---------------------------------------------------------------------------
// Score context map
// ---------------------------------------------------------------------------

const SCORE_CONTEXT: Record<string, string> = {
  "At Risk":
    "Your brand presence has critical gaps that are likely limiting growth and market confidence.",
  "Needs Work":
    "Your brand shows foundational elements but requires focused attention across several key areas.",
  Competitive:
    "Your brand is performing at a market-competitive level with clear opportunities to stand out.",
  Strong:
    "Your brand demonstrates strong fundamentals and is well-positioned to reach best-in-class status.",
  "Best-in-Class":
    "Your brand is operating at an elite level — a powerful foundation for sustained growth.",
};

// ---------------------------------------------------------------------------
// Cover Page
// ---------------------------------------------------------------------------

const CoverPage = ({
  data,
}: {
  data: Pick<SnapshotPDFData, "companyName" | "companyUrl" | "createdAt" | "logoSrc">;
}) => {
  const formattedDate = new Date(data.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Page size="A4" style={[styles.page, { paddingBottom: 40, justifyContent: "center", alignItems: "center" }]}>
      <View style={{ alignItems: "center", width: "100%" }}>
        {/* Logo */}
        <Image src={data.logoSrc} style={{ width: 160, marginBottom: 40 }} />

        {/* Title */}
        <Text
          style={{
            fontSize: 36,
            fontFamily: "Poppins",
            fontWeight: 700,
            color: colors.navy,
            marginBottom: 48,
            textAlign: "center",
          }}
        >
          Brand Snapshot
        </Text>

        {/* Metadata block — each row centered, label bold, value regular */}
        {[
          { label: "Prepared for", value: data.companyName },
          { label: "Website reviewed", value: data.companyUrl },
          { label: "Prepared by", value: "Enid by DLB Creative" },
          { label: "Prepared on", value: formattedDate },
        ].map(({ label, value }) => (
          <Text
            key={label}
            style={{
              fontSize: 10,
              fontFamily: "Poppins",
              fontWeight: 400,
              color: colors.navy,
              textAlign: "center",
              marginBottom: 10,
            }}
          >
            <Text style={{ fontWeight: 700 }}>{label}: </Text>
            {value}
          </Text>
        ))}
      </View>
    </Page>
  );
};

// ---------------------------------------------------------------------------
// Main Document
// ---------------------------------------------------------------------------

const SnapshotDocument = ({ data }: { data: SnapshotPDFData }) => {
  const { snapshot, seoVisibility, enidScore } = data;
  const band = getScoreBand(enidScore);
  const scoreContext = SCORE_CONTEXT[band.label] ?? "";

  const visibilityBadgeColor =
    seoVisibility.visibilityScore === "Strong"
      ? colors.green
      : seoVisibility.visibilityScore === "Moderate"
      ? colors.yellow
      : colors.red;

  const priorityColor = (priority: number): string => {
    if (priority === 1) return colors.red;
    if (priority === 2) return colors.yellow;
    return colors.navy;
  };

  return (
    <Document>
      {/* ------------------------------------------------------------------ */}
      {/* Cover Page                                                          */}
      {/* ------------------------------------------------------------------ */}
      <CoverPage data={data} />

      {/* ------------------------------------------------------------------ */}
      {/* Content Page — all sections, auto-paginated                         */}
      {/* ------------------------------------------------------------------ */}
      <Page size="A4" style={styles.page} wrap>

        {/* Fixed footer on every page */}
        <PageFooter />

        {/* ---------------------------------------------------------------- */}
        {/* 1. YOUR ENID SCORE                                               */}
        {/* ---------------------------------------------------------------- */}
        <View wrap={false}>
          <Text style={styles.sectionHeader}>YOUR ENID SCORE</Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#f0f4f7",
              borderRadius: 8,
              padding: 12,
              marginBottom: 4,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                backgroundColor: band.color,
                borderRadius: 6,
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginRight: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 20,
                  fontFamily: "Poppins",
                  fontWeight: 700,
                  color: colors.white,
                }}
              >
                {enidScore}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: "Poppins",
                  fontWeight: 700,
                  color: colors.navy,
                  marginBottom: 4,
                }}
              >
                {band.label}
              </Text>
              <Stars score={enidScore} />
              <Text
                style={{
                  fontSize: 9,
                  color: colors.grey,
                  lineHeight: 1.4,
                  marginTop: 4,
                }}
              >
                {scoreContext}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* 2. WHAT ENID FOUND                                               */}
        {/* ---------------------------------------------------------------- */}
        <View wrap={false}>
          <Text style={styles.sectionHeader}>WHAT ENID FOUND</Text>
          <Text style={styles.contentText}>{snapshot.what_enid_found}</Text>
          <View style={styles.divider} />
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* 3. TOP 5 BRAND VALUE LEAKS                                       */}
        {/* ---------------------------------------------------------------- */}
        <Text style={styles.sectionHeader}>TOP 5 BRAND VALUE LEAKS</Text>

        {snapshot.top_5_brand_value_leaks.map((leak) => (
          <View key={leak.rank} wrap={false}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  backgroundColor: colors.navy,
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Text
                  style={{
                    color: colors.white,
                    fontFamily: "Poppins",
                    fontWeight: 700,
                    fontSize: 11,
                  }}
                >
                  {leak.rank}
                </Text>
              </View>

              <Text
                style={{
                  fontFamily: "Poppins",
                  fontWeight: 700,
                  fontSize: 11,
                  flex: 1,
                  marginLeft: 8,
                  color: colors.black,
                }}
              >
                {leak.issue}
              </Text>
            </View>

            <Text
              style={{
                fontSize: 10,
                color: colors.grey,
                fontStyle: "italic",
                marginLeft: 30,
                marginBottom: 8,
              }}
            >
              {leak.impact}
            </Text>
          </View>
        ))}

        <View style={styles.divider} />

        {/* ---------------------------------------------------------------- */}
        {/* 4. BRAND SIGNAL SNAPSHOT                                         */}
        {/* ---------------------------------------------------------------- */}
        <View wrap={false}>
          <Text style={styles.sectionHeader}>BRAND SIGNAL SNAPSHOT</Text>
          <Text style={styles.contentText}>{snapshot.brand_signal_snapshot}</Text>
          <View style={styles.divider} />
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* 5. WEBSITE SIGNAL SNAPSHOT                                       */}
        {/* ---------------------------------------------------------------- */}
        <View wrap={false}>
          <Text style={styles.sectionHeader}>WEBSITE SIGNAL SNAPSHOT</Text>
          <Text style={styles.contentText}>{snapshot.website_signal_snapshot}</Text>
          <View style={styles.divider} />
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* 6. VISIBILITY SNAPSHOT                                           */}
        {/* ---------------------------------------------------------------- */}
        <View wrap={false}>
          <Text style={styles.sectionHeader}>VISIBILITY SNAPSHOT</Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <View
              style={{
                backgroundColor: visibilityBadgeColor,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 4,
              }}
            >
              <Text
                style={{
                  color: colors.white,
                  fontFamily: "Poppins",
                  fontWeight: 700,
                  fontSize: 11,
                }}
              >
                {seoVisibility.visibilityScore}
              </Text>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginLeft: 12,
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: seoVisibility.websiteVisible ? colors.green : colors.lightGrey,
                  marginRight: 4,
                }}
              />
              <Text style={{ fontSize: 9, color: colors.grey, marginRight: 10 }}>Website</Text>

              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: seoVisibility.socialVisible ? colors.green : colors.lightGrey,
                  marginRight: 4,
                }}
              />
              <Text style={{ fontSize: 9, color: colors.grey, marginRight: 10 }}>Social</Text>

              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: seoVisibility.pressVisible ? colors.green : colors.lightGrey,
                  marginRight: 4,
                }}
              />
              <Text style={{ fontSize: 9, color: colors.grey }}>Press</Text>
            </View>
          </View>

          <Text style={styles.contentText}>{snapshot.visibility_snapshot}</Text>
          <View style={styles.divider} />
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* 7. WHAT TO FIX FIRST                                             */}
        {/* ---------------------------------------------------------------- */}
        <Text style={styles.sectionHeader}>WHAT TO FIX FIRST</Text>

        {snapshot.what_to_fix_first.map((fix) => (
          <View key={fix.priority} wrap={false} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={{
                  width: 22,
                  height: 22,
                  backgroundColor: priorityColor(fix.priority),
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 3,
                  flexShrink: 0,
                }}
              >
                <Text
                  style={{
                    color: colors.white,
                    fontFamily: "Poppins",
                    fontWeight: 700,
                    fontSize: 9,
                  }}
                >
                  #{fix.priority}
                </Text>
              </View>

              <Text style={{ fontSize: 11, flex: 1, marginLeft: 8, color: colors.black }}>
                {fix.action}
              </Text>
            </View>
          </View>
        ))}

        <View style={styles.divider} />

        {/* ---------------------------------------------------------------- */}
        {/* 8. RECOMMENDED NEXT STEP                                         */}
        {/* ---------------------------------------------------------------- */}
        <View wrap={false}>
          <Text style={styles.sectionHeader}>RECOMMENDED NEXT STEP</Text>

          <View
            style={{
              borderWidth: 2,
              borderColor: colors.navy,
              borderRadius: 8,
              padding: 16,
              backgroundColor: "#f0f4f7",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontFamily: "Poppins",
                fontWeight: 700,
                color: colors.navy,
              }}
            >
              {snapshot.recommended_next_step}
            </Text>
          </View>
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* CTA                                                              */}
        {/* ---------------------------------------------------------------- */}
        <View wrap={false} style={{ marginTop: 20, alignItems: "flex-start" }}>
          <Link src="https://www.askenid.ai/" style={{ textDecoration: "none" }}>
            <View
              style={{
                backgroundColor: "#4BBEC6",
                borderRadius: 8,
                paddingVertical: 10,
                paddingHorizontal: 24,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "Poppins",
                  fontWeight: 700,
                  color: colors.white,
                }}
              >
                Ready to act on this?
              </Text>
            </View>
          </Link>
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* End Notes                                                        */}
        {/* ---------------------------------------------------------------- */}
        <View wrap={false} style={{ marginTop: 32 }}>
          <View style={styles.divider} />

          <Text
            style={{
              fontSize: 9,
              lineHeight: 1.6,
              color: colors.grey,
              marginBottom: 10,
              marginTop: 8,
            }}
          >
            This Snapshot is a fast diagnostic of your brand's public-facing signal. It reviews how clearly your brand communicates who you are, who you are for, why you matter, and where value may be leaking across your digital presence.
          </Text>

          <Text
            style={{
              fontSize: 9,
              lineHeight: 1.6,
              color: colors.grey,
              fontStyle: "italic",
            }}
          >
            This Snapshot is based on publicly available brand, website, search, social, and press signals reviewed at the time of analysis. It is intended as a strategic diagnostic, not a full brand strategy, legal review, technical SEO audit, or market research study.
          </Text>
        </View>

      </Page>
    </Document>
  );
};

export { SnapshotDocument };
