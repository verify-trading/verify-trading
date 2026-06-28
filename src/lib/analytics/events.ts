export const ANALYTICS_EVENTS = {
  demoClicked: "demo_clicked",
  createAccountClicked: "create_account_clicked",
  appStoreClicked: "app_store_clicked",
  openAskClicked: "open_ask_clicked",
  proPlanClicked: "pro_plan_clicked",
  guideClicked: "guide_clicked",
  signUpCompleted: "sign_up_completed",
  firstCheckCompleted: "first_check_completed",
  proUpgradeCompleted: "pro_upgrade_completed",
  returnVisit: "return_visit",
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export type AnalyticsParams = Record<
  string,
  string | number | boolean | null | undefined
>;

