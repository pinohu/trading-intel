export type ComplianceReadiness = {
  ok: boolean;
  grade: "research-only" | "needs-review" | "blocked";
  controls: Array<{
    key: string;
    label: string;
    ready: boolean;
    detail: string;
  }>;
  references: string[];
};

export function buildComplianceReadiness(): ComplianceReadiness {
  const personalizedAdviceEnabled = process.env.ENABLE_PERSONALIZED_ADVICE === "true";
  const paidUsersEnabled = process.env.ENABLE_PAID_USERS === "true";
  const complianceOfficer = Boolean(process.env.COMPLIANCE_OFFICER_EMAIL);
  const controls = [
    {
      key: "research-boundary",
      label: "Research-only boundary",
      ready: !personalizedAdviceEnabled,
      detail: personalizedAdviceEnabled
        ? "Personalized advice flag is enabled; adviser/compliance review is required."
        : "The app labels outputs as research signals and keeps live execution gated.",
    },
    {
      key: "paid-users",
      label: "Paid-user advisory risk",
      ready: !paidUsersEnabled,
      detail: paidUsersEnabled
        ? "Paid access is enabled; marketing/adviser status and disclosures need counsel review."
        : "No paid-user advisory funnel is enabled in environment flags.",
    },
    {
      key: "algorithm-supervision",
      label: "Algorithm supervision",
      ready: true,
      detail: "Risk gates, audit events, validation reports, and kill-switch controls are implemented.",
    },
    {
      key: "compliance-owner",
      label: "Compliance owner",
      ready: complianceOfficer,
      detail: complianceOfficer ? "COMPLIANCE_OFFICER_EMAIL is configured." : "Set COMPLIANCE_OFFICER_EMAIL before expanding beyond personal research.",
    },
  ];
  const blockers = controls.filter((item) => !item.ready && (item.key === "research-boundary" || item.key === "paid-users")).length;
  return {
    ok: true,
    grade: blockers > 0 ? "blocked" : complianceOfficer ? "research-only" : "needs-review",
    controls,
    references: [
      "SEC automated investment advice / robo-adviser guidance",
      "FINRA algorithmic trading supervision and control practices",
      "Do not market AI trading claims as guaranteed, personalized, or registered unless reviewed by qualified counsel.",
    ],
  };
}
