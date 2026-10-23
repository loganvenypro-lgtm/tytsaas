/* eslint-disable @next/next/no-img-element -- covers can be remote */
import { ReturbeMark } from "@/components/returbe-logo"
import type { Post } from "@/lib/blog"
import { cn } from "@/lib/utils"

/** The article's image, or a cover drawn from its first tag when it has none. */
export function PostCover({ post, className }: { post: Post; className?: string }) {
  if (post.image) {
    return <img src={post.image} alt="" className={cn("aspect-[16/10] w-full rounded-3xl object-cover", className)} />
  }
  return (
    <div className={cn("relative aspect-[16/10] w-full overflow-hidden rounded-3xl bg-slate-950", className)}>
      <div aria-hidden className="lp-aurora absolute inset-[-20%] opacity-90" />
      <ReturbeMark className="absolute -right-[8%] -bottom-[18%] size-[70%] opacity-90 drop-shadow-[0_30px_60px_rgba(227,6,26,0.35)]" />
      {post.tags?.[0] && (
        <span className="absolute top-5 left-5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80 ring-1 ring-white/15 backdrop-blur">
          {post.tags[0]}
        </span>
      )}
    </div>
  )
}
