import { headers } from "next/headers";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError, UTApi } from "uploadthing/server";
import { auth } from "@/lib/auth";

export const utapi = new UTApi();

const f = createUploadthing();

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
    .middleware(async () => {
      const session = await auth.api.getSession({
        headers: await headers(),
      });

      if (!session) throw new UploadThingError("Unauthorized");

      return { userId: session?.user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Upload complete for userId: ", metadata.userId);

      console.log("File Url", file.ufsUrl);

      return { uploadedBy: metadata.userId };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
