/**
 * react-pdf primitives for the v2 snapshot template, ported from the
 * client's Lovable prototype (EnidSnapshotReport.tsx + atoms.tsx). Only
 * the atoms that report actually uses are included — Lovable's atoms.tsx
 * also exports BulletList/SignalHeader/KeyTakeaway, which the report never
 * calls, so they're left out here rather than ported unused.
 *
 * react-pdf can't resolve CSS variables, Tailwind classes, or CSS
 * `background: radial-gradient(...)`, so colors are literal (theme.ts) and
 * the cover/CTA glow backgrounds are rebuilt from stacked react-pdf Circles
 * (see RadialGlow) — a close visual match, not a literal port.
 */

import React from "react";
import path from "path";
import {
  Page,
  Text,
  View,
  Image,
  Svg,
  Path,
  Circle,
  Font,
} from "@react-pdf/renderer";
import { colors, in2pt, bandForScore, starsForScore, BAND_RANGES, type Band } from "./theme";

// ---------------------------------------------------------------------------
// Font registration
// ---------------------------------------------------------------------------

const fontsDir = path.join(process.cwd(), "public", "fonts");

Font.register({
  family: "Poppins",
  fonts: [
    { src: path.join(fontsDir, "Poppins-Regular.ttf"), fontWeight: 400 },
    { src: path.join(fontsDir, "Poppins-Bold.ttf"), fontWeight: 700 },
    { src: path.join(fontsDir, "Poppins-Italic.ttf"), fontWeight: 400, fontStyle: "italic" },
  ],
});

Font.register({
  family: "Cal Sans",
  fonts: [
    { src: path.join(fontsDir, "CalSans-Regular.ttf"), fontWeight: 400 },
    { src: path.join(fontsDir, "CalSans-SemiBold.ttf"), fontWeight: 600 },
  ],
});

const LOGO_WHITE = path.join(process.cwd(), "public", "Enid Full Logo White.png");
const LOGO_BLACK = path.join(process.cwd(), "public", "Enid Full Logo Black.png");
/**
 * Not yet supplied — swap for the real DLB Creative logo file once it's
 * placed in public/. Cover/CTA footers fall back to text until then.
 */
const DLB_LOGO_PATH: string | null = null;

// ---------------------------------------------------------------------------
// Sheet + footer
// ---------------------------------------------------------------------------

export const Sheet = ({
  dark = false,
  background,
  children,
}: {
  dark?: boolean;
  /** Full-bleed decorative layer (e.g. GlowBackground) — rendered behind the
   * padded content, sized to the whole page rather than the padding box. */
  background?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <Page
    size="LETTER"
    wrap
    style={{
      backgroundColor: dark ? colors.midnightLens : colors.signalWhite,
      fontFamily: "Poppins",
      color: dark ? colors.pureWhite : colors.midnightLens,
    }}
  >
    {background}
    <View style={{ flex: 1, padding: in2pt(0.55), paddingBottom: in2pt(0.85) }}>{children}</View>
    <PageFooter dark={dark} />
  </Page>
);

const PageFooter = ({ dark }: { dark: boolean }) => (
  <View
    fixed
    style={{
      position: "absolute",
      bottom: in2pt(0.4),
      left: in2pt(0.55),
      right: in2pt(0.55),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderTopWidth: 1,
      borderTopColor: dark ? colors.hairlineOnDark : colors.hairline,
      paddingTop: in2pt(0.1),
    }}
  >
    <Image src={dark ? LOGO_WHITE : LOGO_BLACK} style={{ height: in2pt(0.22), width: "auto" }} />
    <Text
      style={{
        fontFamily: "Cal Sans",
        fontSize: 7,
        letterSpacing: 1,
        color: dark ? "rgba(255,255,255,0.55)" : colors.quietSlate,
      }}
    >
      www.askenid.ai
    </Text>
    <Text
      style={{
        fontFamily: "Cal Sans",
        fontSize: 7,
        letterSpacing: 1,
        color: dark ? "rgba(255,255,255,0.55)" : colors.quietSlate,
      }}
      render={({ pageNumber, totalPages }) =>
        `${String(pageNumber).padStart(2, "0")} / ${String(totalPages).padStart(2, "0")}`
      }
    />
  </View>
);

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <Text
    style={{
      fontFamily: "Cal Sans",
      fontWeight: 600,
      fontSize: 8,
      textTransform: "uppercase",
      letterSpacing: 1.6,
      color: colors.enidTeal,
    }}
  >
    {children}
  </Text>
);

export const PageTitle = ({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) => (
  <Text
    style={{
      marginTop: in2pt(0.08),
      fontFamily: "Cal Sans",
      fontWeight: 600,
      fontSize: 22,
      lineHeight: 1.1,
      color: dark ? colors.pureWhite : colors.midnightLens,
    }}
  >
    {children}
  </Text>
);

export const SubHead = ({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) => (
  <Text
    style={{
      marginTop: in2pt(0.12),
      fontSize: 10,
      lineHeight: 1.55,
      color: dark ? "rgba(255,255,255,0.75)" : colors.quietSlate,
    }}
  >
    {children}
  </Text>
);

export const Body = ({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) => (
  <Text
    style={{
      fontSize: 9,
      lineHeight: 1.6,
      color: dark ? "rgba(255,255,255,0.8)" : "rgba(37,61,77,0.85)",
    }}
  >
    {children}
  </Text>
);

export const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <Text
    style={{
      marginTop: in2pt(0.22),
      marginBottom: in2pt(0.08),
      fontFamily: "Cal Sans",
      fontWeight: 600,
      fontSize: 9,
      textTransform: "uppercase",
      letterSpacing: 1.4,
      color: colors.enidTeal,
    }}
  >
    {children}
  </Text>
);

// ---------------------------------------------------------------------------
// Score visuals
// ---------------------------------------------------------------------------

const STAR_PATH = "M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9 4.8 17.6l1-5.8L1.5 7.7l5.9-.9z";

export const StarRow = ({ score, size = 12 }: { score: number; size?: number }) => {
  const stars = starsForScore(score);
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const filled = Math.max(0, Math.min(1, stars - i));
        return (
          <View key={i} style={{ width: size, height: size, marginRight: 2 }}>
            <Svg width={size} height={size} viewBox="0 0 20 20" style={{ position: "absolute" }}>
              <Path d={STAR_PATH} fill="rgba(0,164,166,0.25)" />
            </Svg>
            {filled > 0 && (
              <View
                style={{
                  position: "absolute",
                  width: size * filled,
                  height: size,
                  overflow: "hidden",
                }}
              >
                <Svg width={size} height={size} viewBox="0 0 20 20">
                  <Path d={STAR_PATH} fill={colors.enidTeal} />
                </Svg>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};

export const BandChip = ({ score, soft = false }: { score: number; soft?: boolean }) => {
  const band: Band = bandForScore(score);
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: 999,
        paddingHorizontal: in2pt(0.12),
        paddingVertical: in2pt(0.03),
        backgroundColor: soft ? band.softBg : band.chipBg,
      }}
    >
      <Text
        style={{
          fontFamily: "Cal Sans",
          fontWeight: 600,
          fontSize: 7.5,
          textTransform: "uppercase",
          letterSpacing: 1.2,
          color: soft ? band.softText : band.chipText,
        }}
      >
        {band.label}
      </Text>
    </View>
  );
};

/** Circular score dial. Size in inches. */
export const ScoreDial = ({ score, size = 1.6, dark = false }: { score: number; size?: number; dark?: boolean }) => {
  const band = bandForScore(score);
  const r = 44;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const px = in2pt(size);
  return (
    <View style={{ width: px, height: px, alignItems: "center", justifyContent: "center" }}>
      <Svg
        width={px}
        height={px}
        viewBox="0 0 100 100"
        style={{ position: "absolute", transform: "rotate(-90deg)" }}
      >
        <Circle
          cx={50}
          cy={50}
          r={r}
          fill="none"
          stroke={dark ? "rgba(255,255,255,0.1)" : colors.hairline}
          strokeWidth={8}
        />
        <Circle
          cx={50}
          cy={50}
          r={r}
          fill="none"
          stroke={band.dialColor}
          strokeWidth={8}
          strokeDasharray={`${c * pct} ${c}`}
          strokeLinecap="round"
        />
      </Svg>
      <View style={{ alignItems: "center" }}>
        <Text
          style={{
            fontFamily: "Cal Sans",
            fontWeight: 600,
            fontSize: size * 22,
            color: dark ? colors.pureWhite : colors.midnightLens,
          }}
        >
          {Math.round(score)}
        </Text>
        <Text
          style={{
            marginTop: in2pt(0.02),
            fontSize: 6.5,
            textTransform: "uppercase",
            letterSpacing: 1,
            color: dark ? "rgba(255,255,255,0.55)" : colors.quietSlate,
          }}
        >
          / 100
        </Text>
      </View>
    </View>
  );
};

/** The 5-tier band-range strip shown next to the overall score on the score page. */
export const BandRangeStrip = ({ score }: { score: number }) => {
  const active = bandForScore(score);
  return (
    <View style={{ flexDirection: "row", gap: in2pt(0.06) }}>
      {BAND_RANGES.map(({ band, range }) => {
        const isActive = band.key === active.key;
        return (
          <View
            key={band.key}
            style={{
              flex: 1,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: isActive ? colors.enidTeal : colors.hairline,
              backgroundColor: isActive ? "rgba(0,164,166,0.06)" : "transparent",
              padding: in2pt(0.08),
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "Cal Sans",
                fontWeight: 600,
                fontSize: 7,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                color: "rgba(37,61,77,0.7)",
              }}
            >
              {range}
            </Text>
            <Text style={{ marginTop: 2, fontFamily: "Cal Sans", fontWeight: 600, fontSize: 8, color: colors.midnightLens }}>
              {band.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

// ---------------------------------------------------------------------------
// Decorative gradient glow (react-pdf equivalent of the CSS radial-gradient
// backgrounds on Lovable's dark cover/CTA sheets)
// ---------------------------------------------------------------------------

/**
 * Soft radial glow built from stacked, fading circles rather than an SVG
 * RadialGradient — react-pdf's gradient support renders as a hard band
 * instead of a smooth radial on a tall, non-square page, so this is a more
 * reliable equivalent to the CSS radial-gradient in the source design.
 */
const RadialGlow = ({ cx, cy, color, maxOpacity }: { cx: number; cy: number; color: string; maxOpacity: number }) => {
  const rings = 40;
  const maxR = in2pt(5);
  // Each ring uses the same small opacity; stacking N of them (painter's
  // algorithm, smallest/innermost on top) compounds toward maxOpacity at the
  // center per 1-(1-p)^N, fading smoothly outward as fewer rings overlap.
  // A handful of big, unequal-opacity rings produced visible stepping instead.
  const perRingOpacity = 1 - Math.pow(1 - maxOpacity, 1 / rings);
  return (
    <>
      {Array.from({ length: rings }).map((_, i) => {
        const t = (rings - i) / rings; // 1 (outermost, drawn first) -> ~0 (innermost, drawn last)
        return <Circle key={i} cx={cx} cy={cy} r={maxR * t} fill={color} fillOpacity={perRingOpacity} />;
      })}
    </>
  );
};

const GlowBackground = ({ variant }: { variant: "cover" | "cta" }) => (
  <Svg
    style={{ position: "absolute", top: 0, left: 0 }}
    width={in2pt(8.5)}
    height={in2pt(11)}
    viewBox={`0 0 ${in2pt(8.5)} ${in2pt(11)}`}
  >
    <RadialGlow cx={in2pt(8.5 * 0.25)} cy={0} color={colors.enidTeal} maxOpacity={0.22} />
    {variant === "cover" && (
      <RadialGlow cx={in2pt(8.5 * 0.85)} cy={in2pt(11)} color={colors.insightPurple} maxOpacity={0.16} />
    )}
  </Svg>
);

// ---------------------------------------------------------------------------
// Cover + CTA sheets
// ---------------------------------------------------------------------------

const PoweredByDlb = () =>
  DLB_LOGO_PATH ? (
    <Image src={DLB_LOGO_PATH} style={{ height: in2pt(0.22), width: "auto" }} />
  ) : (
    <Text style={{ fontFamily: "Cal Sans", fontWeight: 600, fontSize: 9, color: colors.pureWhite }}>
      DLB Creative
    </Text>
  );

export const CoverSheet = ({
  eyebrow,
  title,
  lede,
  meta,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lede?: string;
  meta: { label: string; value: string }[];
}) => (
  <Sheet dark background={<GlowBackground variant="cover" />}>
    <View style={{ flex: 1, flexDirection: "column", height: "100%" }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Image src={LOGO_WHITE} style={{ height: in2pt(0.4), width: "auto" }} />
        <Text
          style={{
            fontFamily: "Cal Sans",
            fontWeight: 600,
            fontSize: 8,
            textTransform: "uppercase",
            letterSpacing: 1.6,
            color: colors.enidTeal,
          }}
        >
          {eyebrow}
        </Text>
      </View>

      <View style={{ marginTop: "auto" }}>
        <Text style={{ fontFamily: "Cal Sans", fontWeight: 600, fontSize: 42, lineHeight: 1.05, color: colors.pureWhite }}>
          {title}
        </Text>
        {lede && (
          <Text style={{ marginTop: in2pt(0.25), maxWidth: in2pt(6), fontSize: 11, lineHeight: 1.55, color: "rgba(255,255,255,0.8)" }}>
            {lede}
          </Text>
        )}

        <View
          style={{
            marginTop: in2pt(0.35),
            paddingTop: in2pt(0.2),
            borderTopWidth: 1,
            borderTopColor: colors.hairlineOnDark,
            flexDirection: "row",
            flexWrap: "wrap",
          }}
        >
          {meta.map((m) => (
            <View key={m.label} style={{ width: "50%", marginBottom: in2pt(0.1) }}>
              <Text
                style={{
                  fontFamily: "Cal Sans",
                  fontWeight: 600,
                  fontSize: 7,
                  textTransform: "uppercase",
                  letterSpacing: 1.4,
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                {m.label}
              </Text>
              <Text style={{ marginTop: 2, fontSize: 10, color: "rgba(255,255,255,0.9)" }}>{m.value}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: in2pt(0.3), flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 7.5, textTransform: "uppercase", letterSpacing: 1.3, color: "rgba(255,255,255,0.45)" }}>
            Brand Intelligence Report
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: in2pt(0.1) }}>
            <Text style={{ fontSize: 7.5, textTransform: "uppercase", letterSpacing: 1.4, color: "rgba(255,255,255,0.55)" }}>
              Powered by
            </Text>
            <PoweredByDlb />
          </View>
        </View>
      </View>
    </View>
  </Sheet>
);

export const CTASheet = ({
  headline,
  body,
  ctaLabel,
  disclaimer,
}: {
  headline: string;
  body: string;
  ctaLabel: string;
  disclaimer?: string;
}) => (
  <Sheet dark background={<GlowBackground variant="cta" />}>
    <View style={{ flex: 1, flexDirection: "column", justifyContent: "center", height: "100%" }}>
      <Eyebrow>Recommended Next Step</Eyebrow>
      <Text style={{ marginTop: in2pt(0.1), maxWidth: in2pt(6.2), fontFamily: "Cal Sans", fontWeight: 600, fontSize: 30, lineHeight: 1.1, color: colors.pureWhite }}>
        {headline}
      </Text>
      <Text style={{ marginTop: in2pt(0.2), maxWidth: in2pt(6), fontSize: 11, lineHeight: 1.6, color: "rgba(255,255,255,0.8)" }}>
        {body}
      </Text>
      <View
        style={{
          marginTop: in2pt(0.3),
          alignSelf: "flex-start",
          borderRadius: 6,
          backgroundColor: colors.enidTeal,
          paddingHorizontal: in2pt(0.3),
          paddingVertical: in2pt(0.14),
        }}
      >
        <Text style={{ fontFamily: "Cal Sans", fontWeight: 600, fontSize: 11, color: colors.pureWhite }}>{ctaLabel}</Text>
      </View>
      {disclaimer && (
        <Text style={{ marginTop: in2pt(0.2), maxWidth: in2pt(6.5), fontSize: 7, fontStyle: "italic", lineHeight: 1.5, color: "rgba(255,255,255,0.5)" }}>
          {disclaimer}
        </Text>
      )}
    </View>
  </Sheet>
);
