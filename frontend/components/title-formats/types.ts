import type { OutlierVideo } from "@/components/top-videos/outlier-card";

/** A video using a format, with the words it put in place of [X]. */
export interface FormatExample {
  slot: string;
  video: OutlierVideo;
}

export interface TrendPoint {
  /** "2026-05" */
  month: string;
  uploads: number;
  views: number;
  /** Average (capped) outlier score of the month's videos. */
  outlier: number | null;
}

export interface TitleFormat {
  id: string;
  /** "I Can't Stop Thinking About [X]" */
  formula: string;
  /** Fixed words before and after [X]; either can be empty. */
  prefix: string;
  suffix: string;
  boost: number;
  videoCount: number;
  channelCount: number;
  lang: string;
  latestAt: string;
  /** Keys of t.titleFormats.drivers. */
  drivers: string[];
  trend: TrendPoint[];
  examples: FormatExample[];
}
