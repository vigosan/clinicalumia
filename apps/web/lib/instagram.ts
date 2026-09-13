export type InstagramPost = {
  id: string;
  permalink: string;
  imageUrl: string;
  alt: string;
};

type InstagramMedia = {
  id: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  caption?: string;
};

const endpoint = "https://graph.instagram.com/v25.0/me/media";
const fields = "id,media_type,media_url,thumbnail_url,permalink,caption";

function toPost(media: InstagramMedia): InstagramPost | null {
  const imageUrl =
    media.media_type === "VIDEO" ? media.thumbnail_url : media.media_url;
  if (!imageUrl) return null;
  const alt = media.caption?.split("\n")[0]?.slice(0, 120).trim();
  return {
    id: media.id,
    permalink: media.permalink,
    imageUrl,
    alt: alt || "Publicación de LUMIA en Instagram",
  };
}

export async function getLatestInstagramPosts(
  limit = 4,
): Promise<InstagramPost[]> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) return [];

  const url = new URL(endpoint);
  url.searchParams.set("fields", fields);
  url.searchParams.set("limit", String(limit * 2));
  url.searchParams.set("access_token", token);

  try {
    const response = await fetch(url, { next: { revalidate: 3600 } });
    if (!response.ok) {
      console.error(
        `Instagram API ${response.status}: ${await response.text()}`,
      );
      return [];
    }
    const { data } = (await response.json()) as { data: InstagramMedia[] };
    return data.flatMap((media) => toPost(media) ?? []).slice(0, limit);
  } catch (error) {
    console.error("Instagram API request failed", error);
    return [];
  }
}
