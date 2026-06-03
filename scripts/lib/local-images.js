import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const PUBLIC_IMAGE_DIR = path.resolve("public", "images", "auto");

function slugify(value) {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function extensionFrom(contentType, url) {
  if (contentType?.includes("avif")) return "avif";
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("webp")) return "webp";
  if (contentType?.includes("gif")) return "gif";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) return "jpg";

  try {
    const ext = path.extname(new URL(url).pathname).replace(".", "").toLowerCase();
    if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return ext === "jpeg" ? "jpg" : ext;
  } catch {
    // Ignore malformed URLs and fall back below.
  }

  return "jpg";
}

async function downloadImage(url, slug) {
  if (!url || url.startsWith("/")) return url;

  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    },
  });

  if (!response.ok) return "";
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) return "";

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1024) return "";

  await mkdir(PUBLIC_IMAGE_DIR, { recursive: true });
  const ext = extensionFrom(contentType, url);
  const fileName = `${slug}.${ext}`;
  await writeFile(path.join(PUBLIC_IMAGE_DIR, fileName), bytes);
  return `/images/auto/${fileName}`;
}

export async function localizeImages(items) {
  const localized = [];

  for (const item of items) {
    const slug = slugify(item.slug || item.title || item.id);
    let localImage = "";
    try {
      localImage = await downloadImage(item.image, slug);
    } catch {
      localImage = "";
    }

    localized.push({
      ...item,
      image:
        localImage || (item.image?.startsWith("/") ? item.image : "/images/news-placeholder.svg"),
    });
  }

  return localized;
}
