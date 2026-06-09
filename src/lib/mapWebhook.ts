import type { AuditReport, CompetitorReport, CompetitorProfile, SocialMediaReport, SocialPlatformReport } from "./auditModel";

export function mapWebhookToAuditCompanyName(_payload: any): string {
  return "Unnamed Company";
}

/**
 * Parse the new webhook format:
 * - Single object in array containing both website and brand data
 * - Website fields: { Score, Assessment, What's Working[], What Needs Attention[] }
 * - Brand fields: { score, assessment, opportunity[] }
 */
export function mapWebhookToAudit(payload: any): AuditReport {
  // Handle array wrapper
  let data: any = payload;
  if (Array.isArray(data)) {
    data = data[0] ?? {};
  }
  if (data?.output) {
    data = data.output;
  }

  const companyName = mapWebhookToAuditCompanyName(data);

  // Helper to extract website field data
  const extractWebsiteField = (fieldName: string) => {
    const field = data[fieldName] ?? {};
    return {
      assessment: field["Assessment"] ?? "",
      whatsWorking: field["What's Working"] ?? [],
      whatsNeedsAttention: field["What Needs Attention"] ?? [],
    };
  };

  // Helper to extract website overview (has Key Takeaway instead of arrays)
  const extractWebsiteOverview = () => {
    const field = data["website_overview"] ?? {};
    return {
      assessment: field["Assessment"] ?? "",
      keyTakeaway: field["Key Takeaway"] ?? "",
    };
  };

  // Helper to extract brand field data (lowercase keys)
  const extractBrandField = (fieldName: string) => {
    const field = data[fieldName] ?? {};
    return {
      assessment: field["assessment"] ?? "",
      opportunity: field["opportunity"] ?? [],
    };
  };

  // Helper to extract brand overview (no opportunity array)
  const extractBrandOverview = () => {
    const field = data["brand_overview"] ?? {};
    return {
      assessment: field["assessment"] ?? "",
    };
  };

  // Helper to extract score from field
  const extractScore = (fieldName: string, capitalCase: boolean = true) => {
    const field = data[fieldName] ?? {};
    return Number(capitalCase ? field["Score"] : field["score"]) || 0;
  };

  // Parse ninety day plan summary
  const rawPlan = data["ninety_day_plan_summary"] ?? {};
  const ninetyDayPlanSummary: Array<Record<string, string[]>> = [];
  
  if (typeof rawPlan === "object" && !Array.isArray(rawPlan)) {
    const planOrder = ["30 Day Plan", "60 Day Plan", "90 Day Plan"];
    for (const planKey of planOrder) {
      if (Array.isArray(rawPlan[planKey])) {
        ninetyDayPlanSummary.push({ [planKey]: rawPlan[planKey] });
      }
    }
  }

  // Parse final synthesis
  const finalSynthesis = data["final_synthesis"] ?? {};

  // Parse social media report if present
  const socialMediaReport = extractSocialMediaReport(data);
  console.log("[mapWebhook] socialMediaReport parsed:", socialMediaReport ? "yes" : "no",
    "| has platform_scores:", !!data["platform_scores"],
    "| has platform_type:", !!data["platform_type"]);

  const competitorReport = extractCompetitorReport(data);

  return {
    id: "latest",
    companyName,
    ...(competitorReport ? { competitorReport } : {}),
    brandReport: {
      brandOverview: extractBrandOverview(),
      whoYouAre: extractBrandField("who_you_are"),
      howYouLook: extractBrandField("how_you_look"),
      howYouSound: extractBrandField("how_you_sound"),
      whoYouServe: extractBrandField("who_you_serve"),
      positionAndMarketFit: extractBrandField("position_and_market_fit"),
      brandHealth: data["brand_health"] ?? "",
      ninetyDayPlanSummary,
    },
    websiteReport: {
      websiteOverview: extractWebsiteOverview(),
      brandExpression: extractWebsiteField("brand_expression_and_visual_execution"),
      messagingAndClarity: extractWebsiteField("messaging_and_clarity"),
      uxAndNavigation: extractWebsiteField("ux_navigation"),
      accessibility: extractWebsiteField("accessibility_and_contrast"),
      ctasTrustConversion: extractWebsiteField("ctas_trust_and_conversion"),
      socialConsistency: extractWebsiteField("social_consistency_check"),
      riskAndConfidenceFraming: extractWebsiteField("risk_and_confidence_framing"),
      finalSynthesis: {
        whatsWorkingOverall: finalSynthesis["What's Working Overall"] ?? [],
        whatsNeedsAttentionOverall: finalSynthesis["What Needs Attention Overall"] ?? [],
      },
    },
    websiteScores: {
      websiteOverview: extractScore("website_overview"),
      brandExpression: extractScore("brand_expression_and_visual_execution"),
      messagingAndClarity: extractScore("messaging_and_clarity"),
      uxAndNavigation: extractScore("ux_navigation"),
      accessibility: extractScore("accessibility_and_contrast"),
      ctasTrustConversion: extractScore("ctas_trust_and_conversion"),
      socialConsistency: extractScore("social_consistency_check"),
      riskAndConfidenceFraming: extractScore("risk_and_confidence_framing"),
    },
    brandScores: {
      brandOverview: extractScore("brand_overview", false),
      whoYouAre: extractScore("who_you_are", false),
      howYouLook: extractScore("how_you_look", false),
      howYouSound: extractScore("how_you_sound", false),
      whoYouServe: extractScore("who_you_serve", false),
      positionAndMarketFit: extractScore("position_and_market_fit", false),
    },
    ...(socialMediaReport ? { socialMediaReport } : {}),
    ...(typeof data["social_error"] === "string" ? { socialMediaError: data["social_error"] } : {}),
    ...(typeof data["competitor_error"] === "string" ? { competitorError: data["competitor_error"] } : {}),
  };
}

/**
 * Parse social media report from the webhook payload.
 *
 * The n8n check webhook returns data structured by "Ignore Keys - Existing1":
 * {
 *   platform_scores: { LinkedIn: { ...row fields }, Instagram: { ...row fields } },
 *   platforms_analyzed: ["LinkedIn", "Instagram"],
 *   overal_evaluation: "cross-platform analysis text"
 * }
 *
 * Each platform row contains: profile_completeness, content_quality,
 * brand_alignment, audience_engagement, posting_frequency, visual_consistency
 * (all as {score, assessment}), platform_average, strengths, weaknesses,
 * recommendations, and overal_evaluation.
 */
function extractSocialMediaReport(data: any): SocialMediaReport | undefined {
  // Helper: extract a { score, assessment } pair from various formats
  const cat = (obj: any): { score: number; assessment: string } => {
    if (!obj || typeof obj !== "object") return { score: 0, assessment: "" };
    return {
      score: Number(obj?.score ?? obj?.Score) || 0,
      assessment: String(obj?.assessment ?? obj?.Assessment ?? ""),
    };
  };

  // Helper: parse JSON strings or arrays (Supabase may store arrays as strings)
  const parseArr = (v: any): string[] => {
    if (Array.isArray(v)) return v;
    if (typeof v === "string") {
      try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
    }
    return [];
  };

  // Helper: build a SocialPlatformReport from a Supabase row
  const buildPlatform = (row: any): SocialPlatformReport => ({
    profileCompleteness: cat(row["profile_completeness"]),
    contentQuality: cat(row["content_quality"]),
    brandAlignment: cat(row["brand_alignment"]),
    audienceEngagement: cat(row["audience_engagement"]),
    postingFrequency: cat(row["posting_frequency"]),
    visualConsistency: cat(row["visual_consistency"]),
    platformAverage: Number(row["platform_average"]) || 0,
    strengths: parseArr(row["strengths"]),
    weaknesses: parseArr(row["weaknesses"] ?? row["issues"]),
    recommendations: parseArr(row["recommendations"]),
    ...(row["social_media_url"] ? { socialMediaUrl: String(row["social_media_url"]) } : {}),
  });

  // Helper: extract the overall evaluation text (may be string or JSON)
  const extractEvalText = (raw: any): string => {
    if (!raw) return "";
    if (typeof raw === "string") return raw;
    if (typeof raw === "object") return JSON.stringify(raw);
    return String(raw);
  };

  // --- Format 1: Nested structure with platform_scores key ---
  // This is what the check webhook's "Ignore Keys - Existing1" returns
  let platformScoresRaw = data["platform_scores"];
  if (platformScoresRaw && typeof platformScoresRaw === "object") {
    if (Array.isArray(platformScoresRaw)) {
      const keyed: Record<string, any> = {};
      for (const item of platformScoresRaw) {
        const name = item?.platform_type ?? item?.platform ?? `Platform ${Object.keys(keyed).length + 1}`;
        keyed[name] = item;
      }
      platformScoresRaw = keyed;
    }

    const platformsAnalyzed: string[] = Array.isArray(data["platforms_analyzed"])
      ? data["platforms_analyzed"]
      : Object.keys(platformScoresRaw);

    const platformScores: Record<string, SocialPlatformReport> = {};
    const averages: number[] = [];
    for (const platform of platformsAnalyzed) {
      const p = platformScoresRaw[platform] ?? {};
      platformScores[platform] = buildPlatform(p);
      if (platformScores[platform].platformAverage > 0) {
        averages.push(platformScores[platform].platformAverage);
      }
    }

    // The cross-platform evaluation may live in several places:
    // 1. Root-level "overal_evaluation" / "overall_evaluation" (from check webhook)
    // 2. Top-level cross-platform keys (cross_platform_scores, overall_assessment, etc.)
    // 3. Inside individual platform data within platform_scores (n8n stores it on each row)
    let rawEval: any = data["overal_evaluation"] ?? data["overall_evaluation"] ?? "";

    // If rawEval is empty or a simple string, check top-level cross-platform keys
    if (!rawEval || typeof rawEval === "string") {
      const topLevel: Record<string, any> = {};
      if (data["cross_platform_scores"]) topLevel.cross_platform_scores = data["cross_platform_scores"];
      if (data["overall_assessment"]) topLevel.overall_assessment = data["overall_assessment"];
      if (data["executive_narrative"]) topLevel.executive_narrative = data["executive_narrative"];
      if (data["ninety_day_action_plan"]) topLevel.ninety_day_action_plan = data["ninety_day_action_plan"];
      if (Object.keys(topLevel).length > 0) {
        rawEval = topLevel;
      }
    }

    // If still empty, look inside individual platform data (the n8n "Ignore Keys" code
    // does not filter out overal_evaluation from each platform row)
    if (!rawEval || (typeof rawEval === "string" && rawEval.length === 0)) {
      for (const platform of platformsAnalyzed) {
        const pData = platformScoresRaw[platform];
        const candidate = pData?.["overal_evaluation"] ?? pData?.["overall_evaluation"];
        if (candidate) {
          rawEval = candidate;
          console.log("[mapWebhook] Found overal_evaluation inside platform:", platform);
          break;
        }
      }
    }

    // If rawEval is a string that looks like JSON, try parsing it into an object
    if (typeof rawEval === "string" && rawEval.startsWith("{")) {
      try {
        const parsed = JSON.parse(rawEval);
        if (parsed && typeof parsed === "object" && (parsed.cross_platform_scores || parsed.overall_assessment)) {
          rawEval = parsed;
        }
      } catch { /* keep as string */ }
    }

    console.log("[mapWebhook] overallEvaluation raw type:", typeof rawEval,
      "| keys:", rawEval && typeof rawEval === "object" ? Object.keys(rawEval) : "n/a",
      "| has cross_platform_scores:", rawEval?.cross_platform_scores !== undefined);
    const overallEvaluation = extractEvalText(rawEval);
    const overallScore = averages.length > 0
      ? Math.round(averages.reduce((a, b) => a + b, 0) / averages.length)
      : 0;

    // Extract not_found_platforms injected by the agent after cross-platform synthesis.
    let notFoundPlatforms: string[] | undefined;
    const evalObj = typeof rawEval === "object" && rawEval !== null ? rawEval : null;
    if (evalObj && Array.isArray((evalObj as any).not_found_platforms)) {
      notFoundPlatforms = (evalObj as any).not_found_platforms as string[];
    } else if (typeof rawEval === "string") {
      try {
        const parsed = JSON.parse(rawEval);
        if (parsed?.not_found_platforms && Array.isArray(parsed.not_found_platforms)) {
          notFoundPlatforms = parsed.not_found_platforms as string[];
        }
      } catch { /* ignore */ }
    }

    return {
      platformsAnalyzed,
      platformScores,
      overallEvaluation,
      overallScore,
      ...(notFoundPlatforms?.length ? { notFoundPlatforms } : {}),
    };
  }

  // --- Format 2: Flat Supabase row (single platform with platform_type at top) ---
  if (data["platform_type"] && data["profile_completeness"]) {
    const platformName = data["platform_type"] as string;
    const platform = buildPlatform(data);

    return {
      platformsAnalyzed: [platformName],
      platformScores: { [platformName]: platform },
      overallEvaluation: extractEvalText(
        data["overal_evaluation"] ?? data["overall_evaluation"] ?? ""
      ),
      overallScore: platform.platformAverage,
    };
  }

  return undefined;
}

/**
 * Parse competitor research data from the webhook payload.
 *
 * The n8n check webhook returns data structured by "Ignore Keys - Existing1":
 * {
 *   competitor_data: { "CompanyName": { ...fields }, ... },
 *   competitors_analyzed: ["CompanyName", ...]
 * }
 */
function extractCompetitorReport(data: any): CompetitorReport | undefined {
  const parseArr = (v: any): any[] => {
    if (Array.isArray(v)) return v;
    if (typeof v === "string") {
      try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
    }
    return [];
  };

  const buildProfile = (row: any): CompetitorProfile => ({
    companyName: row["company_name"] ?? "Unknown",
    companyUrl: row["company_url"] ?? "",
    overview: row["overview"] ?? "",
    size: row["size"] ?? "Unknown",
    location: row["location"] ?? "Unknown",
    competitorType: (row["competitor_type"] ?? "global") as CompetitorProfile["competitorType"],
    advantage: row["advantage"] ?? "",
    disadvantage: row["disadvantage"] ?? "",
    establishedDate: row["established_date"] ?? "Unknown",
    socialLinks: parseArr(row["social_links"]),
    leadership: parseArr(row["leadership"]),
  });

  // Format 1: Nested structure { competitor_data: { "CompanyName": {...} } }
  const competitorData = data["competitor_data"];
  if (competitorData && typeof competitorData === "object" && !Array.isArray(competitorData)) {
    const competitorsAnalyzed: string[] = Array.isArray(data["competitors_analyzed"])
      ? data["competitors_analyzed"]
      : Object.keys(competitorData);

    const competitors: CompetitorProfile[] = competitorsAnalyzed.map((name) => {
      const row = competitorData[name] ?? {};
      return buildProfile(row);
    });

    const landscapeSummary = typeof data["landscape_summary"] === "string"
      ? data["landscape_summary"]
      : undefined;

    return { competitors, competitorsAnalyzed, landscapeSummary };
  }

  // Format 2: Flat array of rows from dlb_competitor_agent_results
  const rawArray = data["competitor_data"] ?? data["competitors"];
  if (Array.isArray(rawArray) && rawArray.length > 0 && rawArray[0]?.company_name) {
    const competitors: CompetitorProfile[] = rawArray.map((row: any) => buildProfile(row));
    const competitorsAnalyzed = competitors.map((c) => c.companyName);
    return { competitors, competitorsAnalyzed };
  }

  // Format 3: Single flat competitor row at root level
  if (data["company_name"] && data["company_url"]) {
    const competitor = buildProfile(data);
    return { competitors: [competitor], competitorsAnalyzed: [competitor.companyName] };
  }

  return undefined;
}
