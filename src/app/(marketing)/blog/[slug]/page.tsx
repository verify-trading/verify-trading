import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleBody, tocFromBlocks } from "@/components/marketing/article";
import { Breadcrumbs, Byline, CtaBand, Toc } from "@/components/marketing/primitives";
import { JsonLd } from "@/components/seo/json-ld";
import { BlogThumb } from "@/components/marketing/blog-thumb";
import { asCategory, getRemoteArticle, type RemoteArticle } from "@/lib/blog/feed";
import { getPost, POSTS, readingTimeMinutes } from "@/lib/blog/posts";
import { NOT_ADVICE_STATEMENT } from "@/lib/marketing/copy";
import { getTerm } from "@/lib/marketing/glossary";
import { articleSchema, pageMetadata } from "@/lib/marketing/seo";

type Props = { params: Promise<{ slug: string }> };

// Hand-written posts are prebuilt; BabyLoveGrowth slugs render on demand and revalidate hourly.
export const revalidate = 3600;
export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).slug;
  const post = getPost(slug);
  if (!post) {
    const a = await getRemoteArticle(slug);
    return a
      ? pageMetadata({ title: a.title, description: a.meta_description, path: `/blog/${a.slug}`, type: "article", publishedTime: a.published_at })
      : {};
  }
  return pageMetadata({
    title: post.title,
    description: post.description,
    path: `/blog/${post.slug}`,
    type: "article",
    publishedTime: post.date,
  });
}

export default async function BlogPostPage({ params }: Props) {
  const slug = (await params).slug;
  const post = getPost(slug);
  if (!post) {
    const remote = await getRemoteArticle(slug);
    if (!remote) notFound();
    return <RemotePost article={remote} />;
  }
  const path = `/blog/${post.slug}`;
  const toc = tocFromBlocks(post.body);
  const terms = (post.terms ?? []).map(getTerm).filter((t) => t !== undefined);

  return (
    <>
      <JsonLd data={articleSchema({ headline: post.title, description: post.description, path, datePublished: post.date, dateModified: post.updated })} />
      <Breadcrumbs crumbs={[{ name: "Blog", path: "/blog" }, { name: post.title, path }]} />
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-16 lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-14">
        <article className="min-w-0 max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-coral)]">{post.category}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-[2.6rem] lg:leading-[1.15]">
            {post.title}
          </h1>
          <div className="mt-4 border-b border-white/[0.08] pb-6">
            <Byline updated={post.updated ?? post.date} extra={`${readingTimeMinutes(post)} min read`} />
          </div>
          <p className="mt-6 text-[17px] leading-8 text-slate-300 font-medium">{post.description}</p>
          <BlogThumb category={asCategory(post.category)} size="banner" className="mt-8 aspect-[21/9] rounded-2xl border border-white/[0.08]" />
          <div className="mt-8">
            <ArticleBody blocks={post.body} />
          </div>

          {terms.length ? (
            <div className="mt-12 border-t border-white/[0.08] pt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--vt-muted)]">Terms in this article</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {terms.map((t) => (
                  <li key={t.slug}>
                    <Link
                      href={`/glossary/${t.slug}`}
                      className="inline-flex rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1 text-xs font-medium text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                    >
                      {t.term}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {post.related && post.related.length > 0 ? (
            <div className="mt-8 border-t border-white/[0.08] pt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--vt-muted)]">Related tools and pages</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {post.related.map((r) => (
                  <li key={r.href}>
                    <Link
                      href={r.href}
                      className="inline-flex rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                    >
                      {r.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="mt-10 text-xs leading-relaxed text-[var(--vt-muted)]">
            This article is general education, not investment advice. It was written by the verify.trading team from public sources; see{" "}
            <Link href="/trust" className="underline hover:text-slate-300">how we write and review</Link>. {NOT_ADVICE_STATEMENT}
          </p>
        </article>
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <Toc items={toc} />
          </div>
        </aside>
      </div>
      <CtaBand
        title="Check a name before you deposit"
        body="Run a free check against regulator records, with the source shown."
        primary={{ label: "Check a name", href: "/ask", event: "ask" }}
        secondary={{ label: "More guides", href: "/blog" }}
        location="blog_post"
      />
    </>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** BabyLoveGrowth article in the same shell as hand-written posts. Body HTML is styled by `.blog-content`. */
function RemotePost({ article: a }: { article: RemoteArticle }) {
  const path = `/blog/${a.slug}`;
  return (
    <>
      <JsonLd data={a.jsonLd ?? articleSchema({ headline: a.title, description: a.meta_description, path, datePublished: a.published_at, dateModified: a.updated_at })} />
      {a.faqJsonLd ? <JsonLd data={a.faqJsonLd} /> : null}
      <Breadcrumbs crumbs={[{ name: "Blog", path: "/blog" }, { name: a.title, path }]} />
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
        <article className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-coral)]">{a.category}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-[2.6rem] lg:leading-[1.15]">{a.title}</h1>
          <p className="mt-4 border-b border-white/[0.08] pb-6 text-xs text-[var(--vt-muted)]">
            <time dateTime={a.published_at}>{dateFmt.format(new Date(a.published_at))}</time> · {a.readMins} min read
          </p>
          <BlogThumb category={a.category} image={a.hero_image_url || null} size="banner" className="mt-8 aspect-[16/9] rounded-2xl border border-white/[0.08]" />
          <div className="blog-content mt-8" dangerouslySetInnerHTML={{ __html: a.html }} />
          <p className="mt-12 border-t border-white/[0.08] pt-6 text-xs leading-relaxed text-[var(--vt-muted)]">
            This article is general education, not investment advice. See{" "}
            <Link href="/trust" className="underline hover:text-slate-300">how we write and review</Link>. {NOT_ADVICE_STATEMENT}
          </p>
        </article>
      </div>
      <CtaBand
        title="Check a name before you deposit"
        body="Run a free check against regulator records, with the source shown."
        primary={{ label: "Check a name", href: "/ask", event: "ask" }}
        secondary={{ label: "More guides", href: "/blog" }}
        location="blog_post"
      />
    </>
  );
}
