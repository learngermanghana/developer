"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";

function getNodeText(node: unknown): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(getNodeText).join("");
  if (node && typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: unknown } }).props;
    return getNodeText(props?.children);
  }
  return "";
}

function InlineCode({
  className,
  children,
  ...props
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
}

function PreBlock({
  children,
}: {
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  const child = Array.isArray(children) ? children[0] : children;
  const className =
    child && typeof child === "object" && "props" in child
      ? ((child as { props?: { className?: string } }).props?.className ?? "")
      : "";

  const codeText = useMemo(() => getNodeText(children).replace(/\n$/, ""), [children]);
  const language = className.replace("language-", "") || "code";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="relative my-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{language}</span>
        <button type="button" onClick={handleCopy} className="copy-btn">
          {copied ? "Copied" : "Copy code"}
        </button>
      </div>
      <pre>{children}</pre>
    </div>
  );
}

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeSlug,
          [
            rehypeAutolinkHeadings,
            {
              behavior: "append",
              properties: {
                className: ["heading-anchor"],
                ariaLabel: "Link to section",
              },
              content: {
                type: "text",
                value: "#",
              },
            },
          ],
        ]}
        components={{
          code: InlineCode,
          pre: PreBlock,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}