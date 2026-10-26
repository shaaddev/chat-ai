export const ATTACHMENT_MEDIA_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const;

export type AttachmentMediaType = (typeof ATTACHMENT_MEDIA_TYPES)[number];

export const ATTACHMENT_MAX_COUNT = 10;
export const ATTACHMENT_MAX_SIZE = "8MB";
export const ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;
export const ATTACHMENT_LIMIT_LABEL = "8 MB";
export const ATTACHMENT_ACCEPT = ATTACHMENT_MEDIA_TYPES.join(",");
export const ATTACHMENT_TYPES_LABEL = "PNG, JPEG, WebP, or GIF images, or PDFs";

export type AttachmentCheck =
  | { ok: true; mediaType: AttachmentMediaType }
  | { ok: false; reason: "type" | "size" };

function isAttachmentMediaType(type: string): type is AttachmentMediaType {
  return (ATTACHMENT_MEDIA_TYPES as readonly string[]).includes(type);
}

export function checkAttachment(file: {
  size: number;
  type: string;
}): AttachmentCheck {
  if (!isAttachmentMediaType(file.type)) {
    return { ok: false, reason: "type" };
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return { ok: false, reason: "size" };
  }
  return { ok: true, mediaType: file.type };
}

export function isImageType(mediaType: string) {
  return mediaType.startsWith("image/");
}

export function attachmentKind(mediaType: string) {
  if (mediaType === "application/pdf") {
    return "PDF";
  }
  if (isImageType(mediaType)) {
    return "Image";
  }
  return "File";
}

const KILOBYTE = 1024;
const MEGABYTE = KILOBYTE * KILOBYTE;

export function formatBytes(bytes: number) {
  if (bytes < KILOBYTE) {
    return `${bytes} B`;
  }
  if (bytes < MEGABYTE) {
    return `${Math.round(bytes / KILOBYTE)} KB`;
  }
  const megabytes = bytes / MEGABYTE;
  return `${megabytes < 10 ? megabytes.toFixed(1) : Math.round(megabytes)} MB`;
}
