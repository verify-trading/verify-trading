"""
skill_vt_site.py — Verify Trading website management via Telegram.

Handles SEO-related page edits (metadata, new pages) as GitHub pull requests.
Vercel deploys previews automatically on every PR; merging to main deploys to
production.  No Firebase logic needed.

Commands:
  vt help                       — show this help
  vt pages                      — list all marketing + legal pages
  vt page /path                 — show page metadata (title, description)
  vt set /path title: ...       — edit a page's <title> / meta description
  vt set /path description: ... — edit a page's meta description
  vt new page /slug: topic      — scaffold a new marketing page
  vt changes                    — list open bot PRs
  vt history                    — recent bot commits (last 20)
  vt discard N                  — close PR #N without merging
  vt preview N                  — Vercel preview link for PR #N
  vt publish N                  — merge PR #N → main (deploys to prod)
"""

from __future__ import annotations

import asyncio
import datetime as _dt
import json
import logging
import os
import re
import subprocess
import textwrap
import urllib.error
import urllib.request
from pathlib import Path
from typing import Optional

from skill_base import Skill, SkillResult, register_skill

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

REPO = os.environ.get("VT_GITHUB_REPO", "verify-trading/verify-trading")
REPO_DIR = Path.home() / "sites" / "verify-trading"
BOT_PREFIX = "seo/bot-"
NOVALAB_LOGINS = {"xhbutrint"}
# Telegram user-ids allowed to publish (merge PRs)
PUBLISHERS = {7448017617}  # Butrint

HELP = textwrap.dedent("""\
    *Verify Trading site commands*

    `vt pages`  — list marketing + legal pages
    `vt page /path`  — show page metadata
    `vt set /path title: New Title`  — edit title
    `vt set /path description: New desc`  — edit description
    `vt new page /slug: topic`  — create a marketing page
    `vt changes`  — open bot PRs
    `vt history`  — recent bot commits
    `vt discard N`  — close PR #N
    `vt preview N`  — Vercel preview URL for PR #N
    `vt publish N`  — merge PR #N to main
""")

_LOCK = asyncio.Lock()

# ---------------------------------------------------------------------------
# Helpers — token / API / git
# ---------------------------------------------------------------------------

def _token() -> str:
    t = os.environ.get("VT_GITHUB_TOKEN", "").strip()
    if not t:
        raise RuntimeError("VT_GITHUB_TOKEN is not set in the environment.")
    return t


def _api(method: str, path: str, data: dict | None = None) -> dict:
    url = f"https://api.github.com{path}" if path.startswith("/") else path
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(
        url, data=body, method=method,
        headers={
            "Authorization": f"token {_token()}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        body_text = e.read().decode(errors="replace")[:400]
        raise RuntimeError(f"GitHub API {method} {path}: {e.code} — {body_text}") from e


def _run(cmd: list[str], cwd: str | Path | None = None, timeout: int = 60) -> str:
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd or REPO_DIR, timeout=timeout)
    if r.returncode != 0:
        raise RuntimeError(f"`{' '.join(cmd[:4])}` failed ({r.returncode}): {(r.stderr or r.stdout)[:400]}")
    return r.stdout


def _ensure_repo():
    """Clone or fetch the repo."""
    if not (REPO_DIR / ".git").is_dir():
        REPO_DIR.parent.mkdir(parents=True, exist_ok=True)
        _run(["git", "clone", f"https://x-access-token:{_token()}@github.com/{REPO}.git",
              str(REPO_DIR)], cwd=REPO_DIR.parent, timeout=120)
    _run(["git", "fetch", "origin"], timeout=60)
    _run(["git", "checkout", "main", "--force"])
    _run(["git", "reset", "--hard", "origin/main"])


def _branch_name(slug: str) -> str:
    ts = _dt.datetime.utcnow().strftime("%Y%m%d-%H%M")
    safe = re.sub(r"[^a-z0-9-]+", "-", slug.lower()).strip("-")[:40]
    return f"{BOT_PREFIX}{ts}-{safe}"[:80]


def _commit_push(branch: str, message: str):
    _run(["git", "add", "-A"])
    diff = _run(["git", "diff", "--cached", "--stat"])
    if not diff.strip():
        raise RuntimeError("Nothing to commit — no changes detected.")
    token = _token()
    remote = f"https://x-access-token:{token}@github.com/{REPO}.git"
    _run(["git", "commit", "-m", message])
    _run(["git", "push", remote, f"HEAD:{branch}"], timeout=60)


def _open_pr(branch: str, title: str, body: str = "") -> dict:
    return _api("POST", f"/repos/{REPO}/pulls", {
        "title": title,
        "head": branch,
        "base": "main",
        "body": body or title,
    })


# ---------------------------------------------------------------------------
# Page discovery  (Next.js App Router)
# ---------------------------------------------------------------------------

_APP_DIR_REL = Path("src/app")


def _page_routes() -> list[dict]:
    """Walk src/app and return [{path, file, group}] for every page.tsx."""
    app_dir = REPO_DIR / _APP_DIR_REL
    pages = []
    for p in sorted(app_dir.rglob("page.tsx")):
        rel = p.relative_to(app_dir)
        parts = list(rel.parts[:-1])  # drop page.tsx
        # Strip route-group parens  (marketing) → marketing
        groups = [x.strip("()") for x in parts if x.startswith("(")]
        clean = [x for x in parts if not x.startswith("(") and not x.startswith("[")]
        route = "/" + "/".join(clean) if clean else "/"
        pages.append({"path": route, "file": str(p.relative_to(REPO_DIR)), "group": groups[0] if groups else ""})
    return pages


def _read_page_meta(filepath: str) -> dict:
    """Extract title, description, path from a page.tsx's source."""
    src = (REPO_DIR / filepath).read_text(errors="replace")
    meta: dict = {}
    # const path = "/about";
    m = re.search(r'const\s+path\s*=\s*"([^"]+)"', src)
    if m:
        meta["path"] = m.group(1)
    # description = "...";
    m = re.search(r'(?:const\s+)?description\s*=\s*\n?\s*"([^"]+)"', src)
    if m:
        meta["description"] = m.group(1)
    # pageMetadata({ title: "...",
    m = re.search(r'pageMetadata\(\{\s*title:\s*"([^"]+)"', src)
    if m:
        meta["title"] = m.group(1)
    return meta


# ---------------------------------------------------------------------------
# Command implementations
# ---------------------------------------------------------------------------

def pages_text() -> str:
    _ensure_repo()
    routes = _page_routes()
    if not routes:
        return "No pages found."
    lines = ["*Verify Trading pages*\n"]
    by_group: dict[str, list] = {}
    for r in routes:
        by_group.setdefault(r["group"] or "root", []).append(r)
    for grp in sorted(by_group):
        lines.append(f"*{grp}*")
        for r in by_group[grp]:
            lines.append(f"  `{r['path']}`")
        lines.append("")
    lines.append(f"Total: {len(routes)} pages")
    return "\n".join(lines)


def page_text(path: str) -> str:
    _ensure_repo()
    path = path if path.startswith("/") else f"/{path}"
    for r in _page_routes():
        if r["path"] == path:
            meta = _read_page_meta(r["file"])
            parts = [f"*Page:* `{path}`", f"*File:* `{r['file']}`"]
            if meta.get("title"):
                parts.append(f"*Title:* {meta['title']}")
            if meta.get("description"):
                parts.append(f"*Description:* {meta['description']}")
            return "\n".join(parts)
    return f"No page found at `{path}`. Use `vt pages` to see all routes."


def set_field(path: str, field: str, value: str) -> str:
    _ensure_repo()
    path = path if path.startswith("/") else f"/{path}"
    route = None
    for r in _page_routes():
        if r["path"] == path:
            route = r
            break
    if not route:
        return f"No page at `{path}`. Use `vt pages` to list them."

    filepath = REPO_DIR / route["file"]
    src = filepath.read_text(errors="replace")
    field_lower = field.lower().strip()

    if field_lower == "title":
        pattern = r'(pageMetadata\(\{\s*title:\s*)"([^"]+)"'
        m = re.search(pattern, src)
        if not m:
            return f"Could not find pageMetadata title in `{route['file']}`."
        old_title = m.group(2)
        src = src[:m.start(2)] + value + src[m.end(2):]
        filepath.write_text(src)
        branch = _branch_name(f"title{path.replace('/', '-')}")
        _run(["git", "checkout", "-b", branch])
        pr = None
        try:
            _commit_push(branch, f"chore(seo): update title on {path}")
            pr = _open_pr(branch, f"Update title: {path}", f"Changed title from \"{old_title}\" to \"{value}\"")
        except Exception:
            _run(["git", "checkout", "main", "--force"])
            raise
        _run(["git", "checkout", "main", "--force"])
        return f"✅ Title updated on `{path}`.\nPR #{pr['number']}: {pr['html_url']}\nVercel will post a preview link on the PR."

    if field_lower == "description":
        pattern = r'((?:const\s+)?description\s*=\s*\n?\s*)"([^"]+)"'
        m = re.search(pattern, src)
        if not m:
            return f"Could not find description in `{route['file']}`."
        old_desc = m.group(2)
        src = src[:m.start(2)] + value + src[m.end(2):]
        filepath.write_text(src)
        branch = _branch_name(f"desc{path.replace('/', '-')}")
        _run(["git", "checkout", "-b", branch])
        pr = None
        try:
            _commit_push(branch, f"chore(seo): update description on {path}")
            pr = _open_pr(branch, f"Update description: {path}", f"Changed description on {path}.")
        except Exception:
            _run(["git", "checkout", "main", "--force"])
            raise
        _run(["git", "checkout", "main", "--force"])
        return f"✅ Description updated on `{path}`.\nPR #{pr['number']}: {pr['html_url']}\nVercel will post a preview link on the PR."

    return f"Unknown field `{field}`. Supported: `title`, `description`."


async def new_page(slug: str, topic: str) -> str:
    _ensure_repo()
    slug = slug.strip("/").lower()
    safe_slug = re.sub(r"[^a-z0-9-]+", "-", slug).strip("-")
    page_dir = REPO_DIR / "src" / "app" / "(marketing)" / safe_slug
    if page_dir.exists():
        return f"Page `/{safe_slug}` already exists. Use `vt set /{safe_slug} ...` to edit it."

    page_dir.mkdir(parents=True)
    title = topic.title()
    desc = f"{topic} — learn more at verify.trading."
    page_tsx = textwrap.dedent(f"""\
        import type {{ Metadata }} from "next";

        import {{ Breadcrumbs, CtaBand, PageHero, Section }} from "@/components/marketing/primitives";
        import {{ JsonLd }} from "@/components/seo/json-ld";
        import {{ pageMetadata, webPageSchema }} from "@/lib/marketing/seo";

        const path = "/{safe_slug}";
        const description = "{desc}";

        export const metadata: Metadata = pageMetadata({{ title: "{title}", description, path }});

        export default function {safe_slug.replace("-", " ").title().replace(" ", "")}Page() {{
          return (
            <>
              <JsonLd data={{webPageSchema({{ name: "{title}", description, path }})}} />
              <Breadcrumbs crumbs={{[{{ name: "{title}", path }}]}} />
              <PageHero
                eyebrow="{title}"
                title={{<>{title}</>}}
                lede="{{description}}"
                primary={{{{ label: "Check a name", href: "/ask", event: "ask" }}}}
                location="{safe_slug}"
              />
              <Section eyebrow="{title}" title="{title}" narrow>
                <p>Content goes here.</p>
              </Section>
              <CtaBand />
            </>
          );
        }}
    """)
    (page_dir / "page.tsx").write_text(page_tsx)

    branch = _branch_name(f"new-{safe_slug}")
    _run(["git", "checkout", "-b", branch])
    pr = None
    try:
        _commit_push(branch, f"feat: add /{safe_slug} page — {topic}")
        pr = _open_pr(branch, f"New page: /{safe_slug}", f"Scaffolded new marketing page for: {topic}")
    except Exception:
        _run(["git", "checkout", "main", "--force"])
        raise
    _run(["git", "checkout", "main", "--force"])
    return f"✅ Created `/{safe_slug}` page.\nPR #{pr['number']}: {pr['html_url']}\nVercel will post a preview link on the PR.\nEdit the content in `src/app/(marketing)/{safe_slug}/page.tsx`."


def changes_text() -> str:
    """List open PRs created by the bot."""
    prs = _api("GET", f"/repos/{REPO}/pulls?state=open&per_page=50")
    bot_prs = [p for p in prs if p["head"]["ref"].startswith(BOT_PREFIX)]
    if not bot_prs:
        return "No open bot PRs for Verify Trading."
    lines = ["*Open Verify Trading bot PRs*\n"]
    for p in bot_prs:
        lines.append(f"  #{p['number']}  {p['title']}\n  {p['html_url']}")
    return "\n".join(lines)


def history_text() -> str:
    """Recent bot commits on main."""
    _ensure_repo()
    out = _run(["git", "log", "--oneline", "-20", "--grep", BOT_PREFIX, "main"])
    if not out.strip():
        out = _run(["git", "log", "--oneline", "-20", "main"])
    return f"*Recent commits (main)*\n```\n{out.strip()}\n```"


def discard(n: int) -> str:
    pr = _api("GET", f"/repos/{REPO}/pulls/{n}")
    if pr.get("state") == "closed":
        return f"PR #{n} is already closed."
    _api("PATCH", f"/repos/{REPO}/pulls/{n}", {"state": "closed"})
    ref = pr["head"]["ref"]
    try:
        _api("DELETE", f"/repos/{REPO}/git/refs/heads/{ref}")
    except Exception:
        pass
    return f"✅ Closed PR #{n} and deleted branch `{ref}`."


def preview(n: int) -> str:
    pr = _api("GET", f"/repos/{REPO}/pulls/{n}")
    if pr.get("state") != "open":
        return f"PR #{n} is not open."
    # Vercel preview URL pattern
    head_ref = pr["head"]["ref"]
    safe_branch = re.sub(r"[^a-z0-9-]", "-", head_ref.lower())
    return (
        f"*PR #{n}:* {pr['title']}\n"
        f"{pr['html_url']}\n\n"
        f"Vercel posts a preview comment on the PR automatically. "
        f"Check the PR page for the preview link."
    )


def publish(n: int) -> str:
    pr = _api("GET", f"/repos/{REPO}/pulls/{n}")
    if pr.get("state") != "open":
        return f"PR #{n} is not open (state: {pr.get('state')})."
    if pr.get("merged"):
        return f"PR #{n} is already merged."
    _api("PUT", f"/repos/{REPO}/pulls/{n}/merge", {
        "merge_method": "squash",
        "commit_title": f"Merge #{n}: {pr['title']}",
    })
    ref = pr["head"]["ref"]
    try:
        _api("DELETE", f"/repos/{REPO}/git/refs/heads/{ref}")
    except Exception:
        pass
    return f"✅ Merged PR #{n} → main. Vercel will deploy to production shortly.\nBranch `{ref}` deleted."


# ---------------------------------------------------------------------------
# Command parser
# ---------------------------------------------------------------------------

_NORM_ALIASES = {
    "pages": "pages", "list": "pages",
    "page": "page",
    "set": "set", "edit": "set",
    "new": "new", "new page": "new", "create": "new",
    "changes": "changes", "prs": "changes", "status": "changes",
    "history": "history", "log": "history",
    "discard": "discard", "close": "discard",
    "preview": "preview",
    "publish": "publish", "merge": "publish",
    "help": "help",
}


def _norm_path(p: str) -> str:
    p = p.strip().strip("`").strip()
    if not p.startswith("/"):
        p = "/" + p
    return p


def parse(text: str) -> Optional[dict]:
    """Parse a vt command. Returns action dict or None."""
    text = text.strip()
    # Match /seo vt ..., /vt ..., or bare vt ...
    for prefix in ("/seo vt", "/seo verifytrading", "/vt", "vt"):
        if text.lower().startswith(prefix):
            rest = text[len(prefix):].strip()
            break
    else:
        return None

    if not rest:
        return {"action": "help"}

    low = rest.lower()

    # vt new page /slug: topic
    m = re.match(r"(?:new\s+page|new|create)\s+/?(\S+?)(?:\s*:\s*(.+))?$", rest, re.I)
    if m:
        slug = m.group(1).strip("/")
        topic = (m.group(2) or slug.replace("-", " ")).strip()
        return {"action": "new", "path": slug, "topic": topic}

    # vt set /path field: value
    m = re.match(r"(?:set|edit)\s+(/?\S+)\s+(title|description)\s*:\s*(.+)", rest, re.I)
    if m:
        return {"action": "set", "path": _norm_path(m.group(1)), "field": m.group(2).lower(), "value": m.group(3).strip()}

    # vt page /path
    m = re.match(r"page\s+(/?\S+)", rest, re.I)
    if m:
        return {"action": "page", "path": _norm_path(m.group(1))}

    # vt discard/preview/publish N
    m = re.match(r"(discard|close|preview|publish|merge)\s+#?(\d+)", rest, re.I)
    if m:
        action = _NORM_ALIASES.get(m.group(1).lower(), m.group(1).lower())
        return {"action": action, "n": int(m.group(2))}

    # Simple single-word commands
    word = low.split()[0]
    if word in _NORM_ALIASES:
        return {"action": _NORM_ALIASES[word]}

    return {"action": "help"}


# ---------------------------------------------------------------------------
# Skill registration
# ---------------------------------------------------------------------------

@register_skill
class VtSiteSkill(Skill):
    name = "vt"
    description = (
        "Verify Trading website edits as GitHub pull requests. Say: "
        "'vt pages', 'vt set /faq title: ...', 'vt new page /slug: topic', "
        "'vt changes', 'vt publish N'."
    )
    command_aliases = ["/seo verifytrading", "/seo vt", "vt"]

    def match_command(self, text):
        return parse(text)

    async def run(self, update, context, args):
        a = args["action"]
        if a == "help":
            return SkillResult(text=HELP)
        if a == "publish":
            uid = getattr(getattr(update, "effective_user", None), "id", None)
            if uid not in PUBLISHERS:
                return SkillResult(text="Only Butrint can publish the Verify Trading site. Nothing was merged.")
        if _LOCK.locked():
            return SkillResult(text="Another Verify Trading change is being prepared. Try again in a minute.")
        async with _LOCK:
            try:
                if a == "pages":
                    return SkillResult(text=await asyncio.to_thread(pages_text))
                if a == "page":
                    return SkillResult(text=await asyncio.to_thread(page_text, args["path"]))
                if a == "set":
                    return SkillResult(text=await asyncio.to_thread(set_field, args["path"], args["field"], args["value"]))
                if a == "new":
                    return SkillResult(text=await new_page(args["path"], args["topic"]))
                if a == "changes":
                    return SkillResult(text=await asyncio.to_thread(changes_text))
                if a == "history":
                    return SkillResult(text=await asyncio.to_thread(history_text))
                if a == "discard":
                    return SkillResult(text=await asyncio.to_thread(discard, args["n"]))
                if a == "preview":
                    return SkillResult(text=await asyncio.to_thread(preview, args["n"]))
                if a == "publish":
                    return SkillResult(text=await asyncio.to_thread(publish, args["n"]))
            except Exception as e:
                logger.exception("vt %s failed", a)
                return SkillResult(text="Verify Trading %s did not work: %s\nNothing was published." % (a, str(e)[:400]))
        return SkillResult(text=HELP)
