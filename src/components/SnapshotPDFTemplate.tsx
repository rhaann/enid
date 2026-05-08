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
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Svg,
  Path,
} from "@react-pdf/renderer";
import { getScoreBand, SCORE_COLORS } from "@/lib/scoring";

// ---------------------------------------------------------------------------
// Palette — mirrors AuditPDFTemplate exactly
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
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 11,
    color: colors.black,
    backgroundColor: colors.white,
  },
  sectionHeader: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: colors.navy,
    marginBottom: 16,
    paddingBottom: 6,
    borderBottomWidth: 3,
    borderBottomColor: colors.yellow,
  },
  itemTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: colors.black,
    marginBottom: 6,
  },
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
  pageNumber: {
    position: "absolute",
    bottom: 20,
    right: 40,
    fontSize: 10,
    color: colors.grey,
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

/**
 * Renders a single five-pointed star as an SVG — filled or empty.
 */
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

/**
 * Renders a row of five stars coloured according to the score band.
 */
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

/**
 * Standalone cover page: logo, title, company info, and a decorative yellow bar.
 */
const CoverPage = ({
  data,
}: {
  data: Pick<
    SnapshotPDFData,
    "companyName" | "companyUrl" | "createdAt" | "logoSrc"
  >;
}) => {
  const formattedDate = new Date(data.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Page size="A4" style={[styles.page, { justifyContent: "center", alignItems: "center" }]}>
      <View style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
        <Image src={data.logoSrc} style={{ width: 160, marginBottom: 24 }} />

        <Text
          style={{
            fontSize: 32,
            fontFamily: "Helvetica-Bold",
            color: colors.navy,
            textAlign: "center",
            marginBottom: 16,
          }}
        >
          Brand Snapshot
        </Text>

        <Text
          style={{
            fontSize: 20,
            color: colors.grey,
            textAlign: "center",
            marginBottom: 4,
          }}
        >
          {data.companyName}
        </Text>

        <Text
          style={{
            fontSize: 12,
            color: colors.grey,
            textAlign: "center",
            marginTop: 4,
          }}
        >
          {data.companyUrl}
        </Text>

        <Text
          style={{
            fontSize: 12,
            color: colors.grey,
            textAlign: "center",
            marginTop: 8,
          }}
        >
          {formattedDate}
        </Text>

        <View
          style={{
            height: 4,
            backgroundColor: colors.yellow,
            borderRadius: 2,
            width: "100%",
            marginTop: 32,
          }}
        />
      </View>
    </Page>
  );
};

// ---------------------------------------------------------------------------
// Main Document
// ---------------------------------------------------------------------------

/**
 * The root React-PDF document for a Brand Snapshot report.
 * Pass this component to `pdf()` inside an API route to generate the buffer.
 *
 * @example
 * const buffer = await pdf(<SnapshotDocument data={snapshotData} />).toBuffer();
 */
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

        {/* Page numbers */}
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
          fixed
        />

        {/* ---------------------------------------------------------------- */}
        {/* 1. YOUR ENID SCORE                                               */}
        {/* ---------------------------------------------------------------- */}
        <Text style={styles.sectionHeader}>YOUR ENID SCORE</Text>

        <Text
          style={{
            fontSize: 48,
            fontFamily: "Helvetica-Bold",
            color: colors.navy,
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          {enidScore}
        </Text>

        <View style={{ alignItems: "center", marginBottom: 8 }}>
          <Stars score={enidScore} />
        </View>

        <Text
          style={{
            fontSize: 14,
            color: colors.grey,
            textAlign: "center",
            marginBottom: 6,
          }}
        >
          {band.label}
        </Text>

        <Text
          style={{
            fontSize: 10,
            color: colors.grey,
            textAlign: "center",
            lineHeight: 1.5,
            marginBottom: 4,
          }}
        >
          {scoreContext}
        </Text>

        <View style={styles.divider} />

        {/* ---------------------------------------------------------------- */}
        {/* 2. WHAT ENID FOUND                                               */}
        {/* ---------------------------------------------------------------- */}
        <Text style={styles.sectionHeader}>WHAT ENID FOUND</Text>
        <Text style={styles.contentText}>{snapshot.what_enid_found}</Text>
        <View style={styles.divider} />

        {/* ---------------------------------------------------------------- */}
        {/* 3. TOP 5 BRAND VALUE LEAKS                                       */}
        {/* ---------------------------------------------------------------- */}
        <Text style={styles.sectionHeader}>TOP 5 BRAND VALUE LEAKS</Text>

        {snapshot.top_5_brand_value_leaks.map((leak) => (
          <View key={leak.rank} wrap={false}>
            {/* Rank badge + issue */}
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
                    fontFamily: "Helvetica-Bold",
                    fontSize: 11,
                  }}
                >
                  {leak.rank}
                </Text>
              </View>

              <Text
                style={{
                  fontFamily: "Helvetica-Bold",
                  fontSize: 11,
                  flex: 1,
                  marginLeft: 8,
                  color: colors.black,
                }}
              >
                {leak.issue}
              </Text>
            </View>

            {/* Impact */}
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
        <Text style={styles.sectionHeader}>BRAND SIGNAL SNAPSHOT</Text>
        <Text style={styles.contentText}>{snapshot.brand_signal_snapshot}</Text>
        <View style={styles.divider} />

        {/* ---------------------------------------------------------------- */}
        {/* 5. WEBSITE SIGNAL SNAPSHOT                                       */}
        {/* ---------------------------------------------------------------- */}
        <Text style={styles.sectionHeader}>WEBSITE SIGNAL SNAPSHOT</Text>
        <Text style={styles.contentText}>{snapshot.website_signal_snapshot}</Text>
        <View style={styles.divider} />

        {/* ---------------------------------------------------------------- */}
        {/* 6. VISIBILITY SNAPSHOT                                           */}
        {/* ---------------------------------------------------------------- */}
        <Text style={styles.sectionHeader}>VISIBILITY SNAPSHOT</Text>

        {/* Badge row */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          {/* Visibility score pill */}
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
                fontFamily: "Helvetica-Bold",
                fontSize: 11,
              }}
            >
              {seoVisibility.visibilityScore}
            </Text>
          </View>

          {/* Indicator dots */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginLeft: 12,
            }}
          >
            {/* Website */}
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: seoVisibility.websiteVisible
                  ? colors.green
                  : colors.lightGrey,
                marginRight: 4,
              }}
            />
            <Text
              style={{
                fontSize: 9,
                color: colors.grey,
                marginRight: 10,
              }}
            >
              Website
            </Text>

            {/* Social */}
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: seoVisibility.socialVisible
                  ? colors.green
                  : colors.lightGrey,
                marginRight: 4,
              }}
            />
            <Text
              style={{
                fontSize: 9,
                color: colors.grey,
                marginRight: 10,
              }}
            >
              Social
            </Text>

            {/* Press */}
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: seoVisibility.pressVisible
                  ? colors.green
                  : colors.lightGrey,
                marginRight: 4,
              }}
            />
            <Text
              style={{
                fontSize: 9,
                color: colors.grey,
              }}
            >
              Press
            </Text>
          </View>
        </View>

        <Text style={styles.contentText}>{snapshot.visibility_snapshot}</Text>
        <View style={styles.divider} />

        {/* ---------------------------------------------------------------- */}
        {/* 7. WHAT TO FIX FIRST                                             */}
        {/* ---------------------------------------------------------------- */}
        <Text style={styles.sectionHeader}>WHAT TO FIX FIRST</Text>

        {snapshot.what_to_fix_first.map((fix) => (
          <View key={fix.priority} wrap={false} style={{ marginBottom: 10 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              {/* Priority badge */}
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
                    fontFamily: "Helvetica-Bold",
                    fontSize: 9,
                  }}
                >
                  #{fix.priority}
                </Text>
              </View>

              {/* Action text */}
              <Text
                style={{
                  fontSize: 11,
                  flex: 1,
                  marginLeft: 8,
                  color: colors.black,
                }}
              >
                {fix.action}
              </Text>
            </View>
          </View>
        ))}

        <View style={styles.divider} />

        {/* ---------------------------------------------------------------- */}
        {/* 8. RECOMMENDED NEXT STEP                                         */}
        {/* ---------------------------------------------------------------- */}
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
              fontFamily: "Helvetica-Bold",
              color: colors.navy,
            }}
          >
            {snapshot.recommended_next_step}
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export { SnapshotDocument };
