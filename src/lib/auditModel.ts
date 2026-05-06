// Types for website section fields
type WebsiteField = {
  assessment: string;
  whatsWorking: string[];
  whatsNeedsAttention: string[];
};

type WebsiteOverviewField = {
  assessment: string;
  keyTakeaway: string;
};

// Types for brand section fields
type BrandOverviewField = {
  assessment: string;
};

type BrandFieldWithOpportunity = {
  assessment: string;
  opportunity: string[];
};

// Types for social media section fields
type SocialCategoryScore = {
  score: number;
  assessment: string;
};

export type SocialPlatformReport = {
  profileCompleteness: SocialCategoryScore;
  contentQuality: SocialCategoryScore;
  brandAlignment: SocialCategoryScore;
  audienceEngagement: SocialCategoryScore;
  postingFrequency: SocialCategoryScore;
  visualConsistency: SocialCategoryScore;
  platformAverage: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  socialMediaUrl?: string;
};

export type SocialMediaReport = {
  platformsAnalyzed: string[];
  platformScores: Record<string, SocialPlatformReport>;
  overallEvaluation: string;
  overallScore: number;
  crossPlatformScores?: Record<string, { score: number; assessment: string }>;
  overallAssessment?: {
    overallScore: number;
    scoreBreakdown: { platformAverageContribution: number; crossPlatformAverageContribution: number };
    keyStrengths: string[];
    criticalGaps: string[];
    missingOpportunities: string[];
    platformPriorityRanking: { platform: string; rank: number; rationale: string }[];
  };
  executiveNarrative?: {
    presenceHealth: string;
    consistencyAnalysis: string;
    resourceAllocation: string;
  };
  ninetyDayActionPlan?: { initiativeTitle: string; actions: string[] }[];
};

export type CompetitorProfile = {
  companyName: string;
  companyUrl: string;
  overview: string;
  size: string;
  location: string;
  competitorType: "local" | "national" | "global";
  advantage: string;
  disadvantage: string;
  establishedDate: string;
  socialLinks: string[];
  leadership: { title: string; name: string }[];
};

export type CompetitorReport = {
  competitors: CompetitorProfile[];
  competitorsAnalyzed: string[];
  landscapeSummary?: string;
};

export type AuditReport = {
  id: string;
  companyName: string;
  createdAt?: string;
  auditStatus?: string;
  activeAgents?: string[];
  competitorReport?: CompetitorReport;
  brandReport: {
    brandOverview: BrandOverviewField;
    whoYouAre: BrandFieldWithOpportunity;
    howYouLook: BrandFieldWithOpportunity;
    howYouSound: BrandFieldWithOpportunity;
    whoYouServe: BrandFieldWithOpportunity;
    positionAndMarketFit: BrandFieldWithOpportunity;
    brandHealth: string;
    ninetyDayPlanSummary: Array<Record<string, string[]>>;
  };
  websiteReport: {
    websiteOverview: WebsiteOverviewField;
    brandExpression: WebsiteField;
    messagingAndClarity: WebsiteField;
    uxAndNavigation: WebsiteField;
    accessibility: WebsiteField;
    ctasTrustConversion: WebsiteField;
    socialConsistency: WebsiteField;
    riskAndConfidenceFraming: WebsiteField;
    finalSynthesis: {
      whatsWorkingOverall: string[];
      whatsNeedsAttentionOverall: string[];
    };
  };
  websiteScores: {
    websiteOverview: number;
    brandExpression: number;
    messagingAndClarity: number;
    uxAndNavigation: number;
    accessibility: number;
    ctasTrustConversion: number;
    socialConsistency: number;
    riskAndConfidenceFraming: number;
  };
  brandScores: {
    brandOverview: number;
    whoYouAre: number;
    howYouLook: number;
    howYouSound: number;
    whoYouServe: number;
    positionAndMarketFit: number;
  };
  socialMediaReport?: SocialMediaReport;
  socialMediaError?: string;
  competitorError?: string;
};

export const fakeAudit: AuditReport = {
  id: "demo",
  companyName: "Actual Insight",
  competitorReport: {
    competitorsAnalyzed: ["DataRobot", "Domino Data Lab", "Dataiku", "C3.ai", "Pecan AI"],
    competitors: [
      {
        companyName: "DataRobot",
        companyUrl: "https://www.datarobot.com",
        overview: "Enterprise AI platform leader offering end-to-end AutoML with deep integrations across the data stack.",
        size: "enterprise 1000+",
        location: "Boston, MA, USA",
        competitorType: "global",
        advantage: "Market leader in enterprise AI; Strong brand recognition; Extensive integration ecosystem; Robust AutoML platform",
        disadvantage: "Premium pricing may exclude SMBs; Complex onboarding; Less personalized service",
        establishedDate: "2012",
        socialLinks: ["https://linkedin.com/company/datarobot", "https://twitter.com/DataRobot"],
        leadership: [{ title: "CEO", name: "Debanjan Saha" }],
      },
      {
        companyName: "Domino Data Lab",
        companyUrl: "https://www.dominodatalab.com",
        overview: "MLOps-focused platform enabling enterprise data science teams to build, deploy, and manage models with reproducibility.",
        size: "medium 51-200",
        location: "San Francisco, CA, USA",
        competitorType: "national",
        advantage: "Enterprise MLOps focus; Strong reproducibility features; Flexible compute management",
        disadvantage: "Narrower market reach; Less brand awareness than leaders; Limited self-serve options",
        establishedDate: "2013",
        socialLinks: ["https://linkedin.com/company/domino-data-lab"],
        leadership: [{ title: "CEO", name: "Thomas Robinson" }],
      },
      {
        companyName: "Dataiku",
        companyUrl: "https://www.dataiku.com",
        overview: "Collaborative data science platform combining visual workflows with code-based capabilities for enterprise AI adoption.",
        size: "large 201-1000",
        location: "New York, NY, USA",
        competitorType: "global",
        advantage: "Collaborative data science platform; Visual workflows for non-coders; Strong enterprise adoption",
        disadvantage: "Can feel complex for small teams; Premium pricing tiers; Steeper learning curve for advanced features",
        establishedDate: "2013",
        socialLinks: ["https://linkedin.com/company/dataiku", "https://twitter.com/dataikiHQ"],
        leadership: [{ title: "CEO", name: "Florian Douetteau" }],
      },
      {
        companyName: "C3.ai",
        companyUrl: "https://www.c3.ai",
        overview: "Enterprise AI application platform delivering industry-specific solutions with strong government and defense contracts.",
        size: "large 201-1000",
        location: "Redwood City, CA, USA",
        competitorType: "global",
        advantage: "Enterprise AI application platform; Industry-specific solutions; Strong government contracts",
        disadvantage: "High cost of implementation; Long sales cycles; Limited SMB focus",
        establishedDate: "2009",
        socialLinks: ["https://linkedin.com/company/c3-ai-suite"],
        leadership: [{ title: "CEO", name: "Thomas Siebel" }],
      },
      {
        companyName: "Pecan AI",
        companyUrl: "https://www.pecan.ai",
        overview: "Low-code predictive analytics platform making AI accessible to business analysts without deep technical expertise.",
        size: "small 1-50",
        location: "Tel Aviv, Israel",
        competitorType: "global",
        advantage: "Low-code predictive analytics; Fast time to value; Accessible for business analysts",
        disadvantage: "Smaller ecosystem; Less customization; Limited brand awareness",
        establishedDate: "2018",
        socialLinks: ["https://linkedin.com/company/pecan-ai"],
        leadership: [{ title: "CEO", name: "Zohar Bronfman" }],
      },
    ],
  },
  brandReport: {
    brandOverview: {
      assessment: "Actual Insight clearly positions itself as a company combining data expertise with AI capabilities to deliver measurable ROI-focused solutions. They explicitly state their problem: AI without data is guesswork, emphasizing reliable AI deployment over hype.",
    },
    whoYouAre: {
      assessment: "The brand emphasizes its approach and values around honesty, integrity, efficiency, and measurable business impact, but lacks an explicit mission or vision statement and origin story.",
      opportunity: [
        "Define explicit mission statement",
        "Detail origin story",
        "Demonstrate values with examples",
      ],
    },
    howYouLook: {
      assessment: "The visual identity uses a clean, modern style with a consistent blue and orange color palette and custom icons. However, the palette and typography are not markedly distinctive from typical tech companies.",
      opportunity: [
        "Develop unique visual elements",
        "Introduce custom imagery or illustrations",
        "Enhance typography distinctiveness",
      ],
    },
    howYouSound: {
      assessment: "The voice is straightforward, outcome-focused, and avoids heavy jargon. However, differentiation is somewhat generic around 'real AI vs hype' without strongly unique value propositions.",
      opportunity: [
        "Craft unique value proposition",
        "Develop consistent brand voice",
        "Create memorable tagline",
      ],
    },
    whoYouServe: {
      assessment: "The audience is vaguely defined as businesses looking to operationalize AI; there is no explicit naming of audience segments by size, role, or industry.",
      opportunity: [
        "Explicitly name target audience",
        "Specify pain points and roles",
        "Prioritize audience segments clearly",
      ],
    },
    positionAndMarketFit: {
      assessment: "Positioning contrasts their realistic, scalable AI deployment approach against traditional overhyped solutions. However, pricing, market scope, and competitive frame of reference are not explicitly clarified.",
      opportunity: [
        "Clarify pricing and market positioning",
        "Specify defensible differentiation",
        "Provide competitive evidence",
      ],
    },
    brandHealth: "Actual Insight demonstrates a solid foundational brand identity focused on delivering measurable AI solutions without hype, but significant gaps exist in explicit mission, audience definition, and compelling differentiation.",
    ninetyDayPlanSummary: [
      {
        "30 Day Plan": [
          "Define clear mission and vision statements",
          "Audit current brand messaging for consistency",
          "Identify and segment primary target audiences",
          "Develop distinctive visual identity elements",
        ],
      },
      {
        "60 Day Plan": [
          "Implement refreshed brand voice across channels",
          "Create and test memorable tagline",
          "Build custom imagery and typography assets",
          "Develop audience-specific messaging frameworks",
        ],
      },
      {
        "90 Day Plan": [
          "Launch updated brand identity publicly",
          "Optimize website for clarity and differentiation",
          "Establish ongoing content strategy reinforcing positioning",
          "Monitor brand health metrics",
        ],
      },
    ],
  },
  websiteReport: {
    websiteOverview: {
      assessment: "The website presents a clear value proposition above the fold with a headline that communicates AI expertise combined with data to deliver measurable ROI.",
      keyTakeaway: "Clear, specific value proposition visible above the fold.",
    },
    brandExpression: {
      assessment: "The site uses a consistent visual system with defined fonts, a cohesive color palette featuring blues and orange accents, and clear typography hierarchy.",
      whatsWorking: [
        "Consistent typography hierarchy",
        "Defined color palette",
        "Client logos reinforce credibility",
      ],
      whatsNeedsAttention: [
        "Some template-based design elements",
        "Limited custom imagery",
        "Visual distinctiveness could improve",
      ],
    },
    messagingAndClarity: {
      assessment: "Messaging is mostly clear and free from jargon, translating features into business benefits such as measurable ROI and data control.",
      whatsWorking: [
        "Plain language headline",
        "Benefit-oriented messaging",
        "Explicit data ownership statement",
      ],
      whatsNeedsAttention: [
        "Lacks concrete metrics",
        "Proof points implied not stated",
        "Some messaging could be more specific",
      ],
    },
    uxAndNavigation: {
      assessment: "Navigation is succinct with clearly labeled sections and a logical structure. Primary call-to-action buttons are visually distinct.",
      whatsWorking: [
        "Clear main navigation items",
        "Visible distinct CTAs",
        "Logical content hierarchy",
      ],
      whatsNeedsAttention: [
        "Menu styling could be more distinct",
        "Limited micro-interactions",
        "Opportunities for improving user flow",
      ],
    },
    accessibility: {
      assessment: "The website uses strong contrast ratios with dark text on white or light backgrounds meeting accessibility standards.",
      whatsWorking: [
        "Good text contrast ratios",
        "Semantic HTML structure",
        "Proper form labeling",
      ],
      whatsNeedsAttention: [
        "Focus states not clearly visible",
        "ARIA roles not explicit",
        "No alternative text for decorative images",
      ],
    },
    ctasTrustConversion: {
      assessment: "CTAs are concise, action-oriented, and visually separated from other elements, inviting engagement.",
      whatsWorking: [
        "Clear action-driven CTAs",
        "Recognizable client logos",
        "CTAs appear multiple times",
      ],
      whatsNeedsAttention: [
        "No explicit testimonials visible",
        "Case studies not present",
        "Trust proof could be more specific",
      ],
    },
    socialConsistency: {
      assessment: "Visual and messaging alignment cannot be fully confirmed without direct social links visible in the provided HTML.",
      whatsWorking: [
        "Assumed aligned visual branding",
        "Consistent messaging tone expected",
        "Profiles likely maintained",
      ],
      whatsNeedsAttention: [
        "Social links not visible on site",
        "No evidence of recent posts",
        "Messaging alignment unverified",
      ],
    },
    riskAndConfidenceFraming: {
      assessment: "The website includes basic contact information including location and a contact form with prompt response promises.",
      whatsWorking: [
        "Contact form with quick response",
        "Business location stated",
        "Clear communication commitments",
      ],
      whatsNeedsAttention: [
        "No full physical address listed",
        "No leadership or team info",
        "Missing privacy/legal policies",
      ],
    },
    finalSynthesis: {
      whatsWorkingOverall: [
        "Clear value proposition and messaging",
        "Consistent visual and typographic system",
        "Effective CTAs and visible client logos",
      ],
      whatsNeedsAttentionOverall: [
        "Add concrete proof points and metrics",
        "Enhance trust with leadership and policies",
        "Improve visible social presence and accessibility details",
      ],
    },
  },
  websiteScores: {
    websiteOverview: 72,
    brandExpression: 70,
    messagingAndClarity: 72,
    uxAndNavigation: 70,
    accessibility: 70,
    ctasTrustConversion: 72,
    socialConsistency: 65,
    riskAndConfidenceFraming: 65,
  },
  brandScores: {
    brandOverview: 70,
    whoYouAre: 55,
    howYouLook: 62,
    howYouSound: 60,
    whoYouServe: 52,
    positionAndMarketFit: 55,
  },
  socialMediaReport: {
    platformsAnalyzed: ["LinkedIn", "Instagram"],
    overallEvaluation:
      "Social media presence shows early-stage execution without a clear strategy. LinkedIn has foundational company information but suffers from very low posting frequency (1-2 posts/month) and minimal engagement. Instagram appears largely inactive with no cohesive content strategy. Cross-platform consistency is weak — profile images match but messaging, visual style, and tone vary significantly. Immediate priority should be LinkedIn (highest B2B strategic value), with a decision needed on whether Instagram warrants continued investment.",
    overallScore: 59,
    platformScores: {
      LinkedIn: {
        profileCompleteness: {
          score: 68,
          assessment:
            "Profile has a logo, banner, and basic company description but lacks a compelling tagline and featured content.",
        },
        contentQuality: {
          score: 62,
          assessment:
            "Posts are mostly reshares and announcements with limited original thought-leadership content.",
        },
        brandAlignment: {
          score: 65,
          assessment:
            "Messaging loosely aligns with the website but lacks the specific ROI-focused language found on the site.",
        },
        audienceEngagement: {
          score: 58,
          assessment:
            "Low engagement rates on most posts. Minimal comments and shares. No evidence of community interaction.",
        },
        postingFrequency: {
          score: 55,
          assessment:
            "Inconsistent posting schedule. Last post was 18 days ago. Averages 1-2 posts per month.",
        },
        visualConsistency: {
          score: 64,
          assessment:
            "Some posts use brand colors but many are unbranded stock images or plain text posts.",
        },
        platformAverage: 62,
        strengths: [
          "Complete basic profile information",
          "Consistent company branding on profile",
          "Some evidence of industry-relevant content",
        ],
        weaknesses: [
          "Very low posting frequency for LinkedIn standards",
          "Minimal audience engagement and interaction",
          "Lack of original thought-leadership content",
          "Inconsistent visual branding in posts",
        ],
        recommendations: [
          "Establish a 3-5 posts/week publishing cadence",
          "Create original thought-leadership articles on AI + data topics",
          "Develop branded post templates for visual consistency",
          "Actively engage with comments and industry conversations",
          "Add featured content showcasing key case studies",
        ],
      },
      Instagram: {
        profileCompleteness: {
          score: 60,
          assessment:
            "Profile has a logo and brief bio but lacks highlights, a compelling CTA, and link-in-bio strategy.",
        },
        contentQuality: {
          score: 55,
          assessment:
            "Content is sparse with mostly corporate announcements. No storytelling, behind-the-scenes, or value-driven posts.",
        },
        brandAlignment: {
          score: 58,
          assessment:
            "Visual style does not match the clean, professional website aesthetic. Posts feel disconnected from the brand.",
        },
        audienceEngagement: {
          score: 52,
          assessment:
            "Very low engagement. Few likes, no meaningful comments. No evidence of community building.",
        },
        postingFrequency: {
          score: 50,
          assessment:
            "Last post was over 30 days ago. No consistent cadence. Platform appears neglected.",
        },
        visualConsistency: {
          score: 56,
          assessment:
            "No cohesive grid aesthetic. Mixed image quality. Brand colors not consistently applied.",
        },
        platformAverage: 55,
        strengths: [
          "Profile image matches other platforms",
          "Bio includes website link",
        ],
        weaknesses: [
          "Platform appears largely inactive",
          "No Instagram-specific content strategy",
          "Visual grid lacks cohesion and brand identity",
          "Zero community engagement or interaction",
        ],
        recommendations: [
          "Decide if Instagram is strategically valuable or reallocate effort",
          "If keeping, establish 4-7 posts/week with Instagram-native content",
          "Create a cohesive visual grid using brand color palette",
          "Leverage Stories and Reels for behind-the-scenes and quick tips",
          "Build out highlights for key topics (Services, Team, Results)",
        ],
      },
    },
  },
};

export function getAuditById(id: string) {
  return id === fakeAudit.id ? fakeAudit : null;
}

export function normalizeAuditId(id?: string) {
  if (!id || id === "undefined") return "demo";
  return id;
}
