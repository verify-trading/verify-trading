/** Blog categories (client-safe: no API client or post bodies). */
export const BLOG_CATEGORIES = [
  "Broker safety",
  "Prop firms",
  "Risk management",
  "Trading psychology",
  "Markets and news",
] as const;
export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

export type BlogCard = {
  slug: string;
  title: string;
  excerpt: string;
  category: BlogCategory;
  date: string;
  readMins: number | null;
};
