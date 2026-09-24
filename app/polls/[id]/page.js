import PollSessionClient from "./PollSessionClient";
import { formatCount, getPollForMetadata, getSiteUrl, SITE_NAME } from "../../lib/pollMetadata";

export async function generateMetadata({ params }) {
  const poll = await getPollForMetadata(params?.id);
  const title = poll?.title || SITE_NAME;
  const description = poll
    ? `${formatCount(poll.total_votes)} votes - Vote on ${SITE_NAME}`
    : `Vote on ${SITE_NAME}`;
  const url = `${getSiteUrl()}/polls/${encodeURIComponent(params?.id || "")}`;
  const image = `${getSiteUrl()}/api/polls/${encodeURIComponent(params?.id || "")}/opengraph-image`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      images: [
        {
          url: image,
          alt: title,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default function PollSessionPage() {
  return <PollSessionClient />;
}
