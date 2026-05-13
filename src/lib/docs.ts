import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const DOCS_DIR = path.join(process.cwd(), "docs");
const ALLOWED_EXTENSIONS = new Set([".md", ".mdx", ".php"]);

export type DocRecord = {
  slug: string;
  title: string;
  description: string;
  content: string;
  filePath: string;
  extension: string;
};

function stripMarkdown(input: string) {
  return input
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_>~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function prettifySlug(slug: string) {
  return slug
    .split(/[-_/\\]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function findTitle(content: string, fallback: string) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? stripMarkdown(match[1]) : fallback;
}

function findDescription(content: string) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const isHeading = /^#{1,6}\s/.test(line);
    const isList = /^[-*]\s/.test(line) || /^\d+\.\s/.test(line);
    const isCodeFence = /^```/.test(line);

    if (!isHeading && !isList && !isCodeFence) {
      return stripMarkdown(line).slice(0, 180);
    }
  }

  return "Sedifex developer documentation.";
}

function walkDocs(dir: string, prefix = ""): string[] {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const relativePath = prefix ? path.join(prefix, entry.name) : entry.name;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkDocs(fullPath, relativePath));
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) {
      files.push(relativePath);
    }
  }

  return files;
}

function normalizeSlash(value: string) {
  return value.split(path.sep).join("/");
}

function readDoc(relativeFilePath: string): DocRecord {
  const fullPath = path.join(DOCS_DIR, relativeFilePath);
  const raw = fs.readFileSync(fullPath, "utf8");
  const extension = path.extname(relativeFilePath).toLowerCase();
  const isMarkdown = extension === ".md" || extension === ".mdx";

  const parsed = isMarkdown
    ? matter(raw)
    : {
        data: {},
        content: `\`\`\`${extension.replace(".", "")}\n${raw}\n\`\`\``,
      };

  const slug = normalizeSlash(relativeFilePath.replace(/\.(md|mdx|php)$/i, ""));
  const fallbackTitle = isMarkdown
    ? findTitle(parsed.content, prettifySlug(path.basename(slug)))
    : prettifySlug(path.basename(slug));

  const title =
    typeof parsed.data.title === "string" && parsed.data.title.trim()
      ? parsed.data.title.trim()
      : fallbackTitle;

  const description =
    typeof parsed.data.description === "string" && parsed.data.description.trim()
      ? parsed.data.description.trim()
      : isMarkdown
      ? findDescription(parsed.content)
      : `Source file: ${normalizeSlash(relativeFilePath)}`;

  return {
    slug,
    title,
    description,
    content: parsed.content,
    filePath: normalizeSlash(relativeFilePath),
    extension,
  };
}

export function getAllDocs(): DocRecord[] {
  return walkDocs(DOCS_DIR)
    .map(readDoc)
    .sort((a, b) => a.filePath.localeCompare(b.filePath));
}

export function getDocBySlug(slug: string | string[]): DocRecord | null {
  const value = Array.isArray(slug) ? slug.join("/") : slug;
  return getAllDocs().find((doc) => doc.slug === value) ?? null;
}