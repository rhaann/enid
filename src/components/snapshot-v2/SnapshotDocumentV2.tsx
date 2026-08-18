/**
 * v2 snapshot PDF — react-pdf port of the client's Lovable prototype
 * (EnidSnapshotReport.tsx). Five sections, each its own <Sheet> (Page):
 * cover, score, leaks, signals, CTA. Sections wrap onto extra physical
 * pages if content runs long rather than truncating.
 */

import React from "react";
import { Document, View, Text } from "@react-pdf/renderer";
import { Sheet, Eyebrow, PageTitle, SubHead, Body, SectionLabel, StarRow, BandChip, ScoreDial, BandRangeStrip, CoverSheet, CTASheet } from "./atoms";
import { colors, in2pt, bandForScore, starsForScore, SCORE_CONTEXT } from "./theme";

export interface SnapshotV2Leak {
  title: string;
  why: string;
}

export interface SnapshotV2Signal {
  title: string;
  score: number;
  body: string;
}

export interface SnapshotV2Data {
  companyName: string;
  companyUrl: string;
  createdAt: string;
  overallScore: number;
  whatEnidFound: string;
  leaks: SnapshotV2Leak[];
  signals: SnapshotV2Signal[];
  fixFirst: string[];
  recommendedNextStep: string;
}

const CoverPage = ({ data }: { data: SnapshotV2Data }) => {
  const formattedDate = new Date(data.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <CoverSheet
      eyebrow="Ask Enid"
      title={
        <>
          The Brand{"\n"}Snapshot
        </>
      }
      lede="See your brand the way investors, buyers, and competitors already do."
      meta={[
        { label: "Prepared for", value: data.companyName },
        { label: "Website reviewed", value: data.companyUrl },
        { label: "Prepared by", value: "Enid by DLB Creative" },
        { label: "Prepared on", value: formattedDate },
      ]}
    />
  );
};

const ScorePage = ({ data }: { data: SnapshotV2Data }) => {
  const band = bandForScore(data.overallScore);
  const scoreContext = SCORE_CONTEXT[band.key];
  return (
    <Sheet>
      <Eyebrow>Your Enid Score</Eyebrow>
      <PageTitle>The signal from your brand, scored.</PageTitle>
      <SubHead>
        Your Enid Score is a 0–100 rating of how clearly your brand converts attention into confidence across every
        public-facing surface. Below is the summary. The pages that follow explain what drove it.
      </SubHead>

      <View
        wrap={false}
        style={{
          marginTop: in2pt(0.3),
          flexDirection: "row",
          gap: in2pt(0.3),
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.hairline,
          backgroundColor: "rgba(37,61,77,0.02)",
          padding: in2pt(0.28),
        }}
      >
        <View style={{ width: in2pt(2.2), alignItems: "center", justifyContent: "center" }}>
          <ScoreDial score={data.overallScore} size={1.9} />
          <View style={{ marginTop: in2pt(0.15) }}>
            <StarRow score={data.overallScore} size={16} />
          </View>
          <View style={{ marginTop: in2pt(0.1) }}>
            <BandChip score={data.overallScore} />
          </View>
          <Text
            style={{
              marginTop: in2pt(0.08),
              fontSize: 7.5,
              textTransform: "uppercase",
              letterSpacing: 1.2,
              color: colors.quietSlate,
            }}
          >
            {starsForScore(data.overallScore).toFixed(1)} / 5.0 Stars
          </Text>
        </View>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Text style={{ fontFamily: "Cal Sans", fontWeight: 600, fontSize: 11, color: "rgba(37,61,77,0.9)" }}>
            {scoreContext}
          </Text>
          <View style={{ marginTop: in2pt(0.15) }}>
            <BandRangeStrip score={data.overallScore} />
          </View>
        </View>
      </View>

      <SectionLabel>What Enid Found</SectionLabel>
      <Body>{data.whatEnidFound}</Body>
    </Sheet>
  );
};

const LeaksPage = ({ data }: { data: SnapshotV2Data }) => (
  <Sheet>
    <Eyebrow>Top 5 Brand Value Leaks</Eyebrow>
    <PageTitle>Where value is leaking today.</PageTitle>

    <View style={{ marginTop: in2pt(0.22), gap: in2pt(0.14) }}>
      {data.leaks.map((leak, i) => (
        <View
          key={i}
          wrap={false}
          style={{
            flexDirection: "row",
            gap: in2pt(0.15),
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.hairline,
            backgroundColor: "rgba(37,61,77,0.02)",
            padding: in2pt(0.16),
          }}
        >
          <View style={{ width: in2pt(0.55), alignItems: "center" }}>
            <View
              style={{
                width: in2pt(0.42),
                height: in2pt(0.42),
                borderRadius: in2pt(0.21),
                backgroundColor: colors.enidTeal,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontFamily: "Cal Sans", fontWeight: 600, fontSize: 15, color: colors.pureWhite }}>
                {i + 1}
              </Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "Cal Sans", fontWeight: 600, fontSize: 9.5, lineHeight: 1.4, color: colors.midnightLens }}>
              {leak.title}
            </Text>
            <Text
              style={{
                marginTop: in2pt(0.08),
                paddingTop: in2pt(0.06),
                borderTopWidth: 1,
                borderTopColor: colors.hairline,
                fontSize: 8.5,
                fontStyle: "italic",
                lineHeight: 1.5,
                color: colors.quietSlate,
              }}
            >
              {leak.why}
            </Text>
          </View>
        </View>
      ))}
    </View>
  </Sheet>
);

const SignalsPage = ({ data }: { data: SnapshotV2Data }) => (
  <Sheet>
    <Eyebrow>Signal Snapshots</Eyebrow>
    <PageTitle>Three signals, one story.</PageTitle>

    <View style={{ marginTop: in2pt(0.2), flexDirection: "row", gap: in2pt(0.18) }}>
      {data.signals.map((s) => (
        <View
          key={s.title}
          wrap={false}
          style={{
            flex: 1,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.hairline,
            padding: in2pt(0.2),
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
            <Text style={{ fontFamily: "Cal Sans", fontWeight: 600, fontSize: 12, color: colors.midnightLens }}>
              {s.title}
            </Text>
            <Text style={{ fontFamily: "Cal Sans", fontWeight: 600, fontSize: 15, color: colors.midnightLens }}>
              {s.score}
            </Text>
          </View>
          <View style={{ marginTop: in2pt(0.1) }}>
            <StarRow score={s.score} size={11} />
          </View>
          <View style={{ marginTop: in2pt(0.07) }}>
            <BandChip score={s.score} soft />
          </View>
          <Text style={{ marginTop: in2pt(0.12), fontSize: 8.5, lineHeight: 1.55, color: "rgba(37,61,77,0.8)" }}>
            {s.body}
          </Text>
        </View>
      ))}
    </View>

    <SectionLabel>What to Fix First</SectionLabel>
    <View style={{ flexDirection: "row", gap: in2pt(0.15) }}>
      {data.fixFirst.map((f, i) => (
        <View
          key={i}
          wrap={false}
          style={{
            flex: 1,
            borderRadius: 8,
            backgroundColor: "rgba(0,164,166,0.06)",
            padding: in2pt(0.14),
          }}
        >
          <Text style={{ fontFamily: "Cal Sans", fontWeight: 600, fontSize: 16, color: colors.enidTeal }}>
            #{i + 1}
          </Text>
          <Text style={{ marginTop: in2pt(0.08), fontSize: 8.5, lineHeight: 1.5, color: "rgba(37,61,77,0.85)" }}>
            {f}
          </Text>
        </View>
      ))}
    </View>
  </Sheet>
);

const CtaPage = ({ data }: { data: SnapshotV2Data }) => (
  <CTASheet
    headline="Get the full Brand Intelligence Report."
    body={data.recommendedNextStep}
    ctaLabel="Book the Review →"
    disclaimer="This Snapshot is based on publicly available brand, website, search, social, and press signals reviewed at the time of analysis. It is intended as a strategic diagnostic, not a full brand strategy, legal review, technical SEO review, or market research study."
  />
);

const SnapshotDocumentV2 = ({ data }: { data: SnapshotV2Data }) => (
  <Document>
    <CoverPage data={data} />
    <ScorePage data={data} />
    <LeaksPage data={data} />
    <SignalsPage data={data} />
    <CtaPage data={data} />
  </Document>
);

export { SnapshotDocumentV2 };
