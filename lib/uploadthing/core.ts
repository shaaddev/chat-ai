import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError, UTApi } from "uploadthing/server";
import type { UploadedFileData } from "uploadthing/types";
import { auth } from "@/app/auth";
import { saveUpload } from "@/lib/db/queries";

export const utapi = new UTApi();

const f = createUploadthing();

async function requireUser() {
  const session = await auth();

  if (!session) {
    throw new UploadThingError("Unauthorized");
  }

  return { userId: session.user.id };
}

async function recordUpload({
  metadata,
  file,
}: {
  metadata: { userId: string };
  file: UploadedFileData;
}) {
  await saveUpload({
    key: file.key,
    userId: metadata.userId,
    url: file.ufsUrl,
    name: file.name,
    mediaType: file.type,
    size: file.size,
  });

  return { uploadedBy: metadata.userId };
}

export const ourFileRouter = {
  imageUploader: f({
    image: {
      maxFileSize: "8MB",
      maxFileCount: 2,
      acl: "public-read",
    },
    pdf: {
      maxFileSize: "8MB",
      maxFileCount: 2,
    },
  })
    .middleware(requireUser)
    .onUploadComplete(recordUpload),
  documentUploader: f({
    pdf: {
      maxFileSize: "8MB",
      maxFileCount: 1,
    },
    blob: {
      maxFileSize: "8MB",
      maxFileCount: 1,
    },
  })
    .middleware(requireUser)
    .onUploadComplete(recordUpload),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
