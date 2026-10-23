/* eslint-disable @next/next/no-img-element -- article images can be remote */
import type { MDXComponents } from "mdx/types"
import Link from "next/link"

import { Callout, Cta } from "@/components/blog/mdx-blocks"
import { cn } from "@/lib/utils"

// Article typography, in the landing page's palette (slate text, blue accents)
const components: MDXComponents = {
  h2: ({ className, ...props }) => (
    <h2 className={cn("mt-14 scroll-mt-24 text-3xl font-semibold tracking-[-0.02em] text-slate-950", className)} {...props} />
  ),
  h3: ({ className, ...props }) => (
    <h3 className={cn("mt-10 scroll-mt-24 text-xl font-semibold tracking-tight text-slate-950", className)} {...props} />
  ),
  p: (props) => <p className="mt-5 text-[17px] leading-8 text-slate-600" {...props} />,
  a: ({ href = "", ...props }) => {
    const className = "font-medium text-blue-600 underline decoration-blue-600/30 underline-offset-4 hover:decoration-blue-600"
    return href.startsWith("/") || href.startsWith("#") ? (
      <Link href={href} className={className} {...props} />
    ) : (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} {...props} />
    )
  },
  ul: (props) => <ul className="mt-5 list-disc space-y-2 pl-6 text-[17px] leading-8 text-slate-600 marker:text-blue-500" {...props} />,
  ol: (props) => <ol className="mt-5 list-decimal space-y-2 pl-6 text-[17px] leading-8 text-slate-600 marker:text-slate-400" {...props} />,
  strong: (props) => <strong className="font-semibold text-slate-900" {...props} />,
  blockquote: (props) => <blockquote className="mt-8 border-l-2 border-blue-500 pl-5 text-lg text-slate-700 italic [&>p]:mt-0" {...props} />,
  hr: () => <hr className="my-12 border-slate-200" />,
  img: ({ alt = "", ...props }) => <img alt={alt} className="mt-8 w-full rounded-2xl border border-slate-200" {...props} />,
  code: (props) => <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-800" {...props} />,
  pre: (props) => (
    <pre className="mt-6 overflow-x-auto rounded-2xl bg-slate-950 p-5 text-sm leading-7 text-slate-100 [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-inherit" {...props} />
  ),
  table: (props) => (
    <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200">
      <table className="w-full text-left text-sm" {...props} />
    </div>
  ),
  th: (props) => <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-900" {...props} />,
  td: (props) => <td className="border-b border-slate-100 px-4 py-3 text-slate-600" {...props} />,
  Callout,
  Cta,
}

export function useMDXComponents(): MDXComponents {
  return components
}
