import { utapi } from "./core";

const FILE_KEY_PATH_REGEX = /\/f\/(.+)$/;

export function extractFileKey(url: string): string | null {
  try {
    const urlObj = new URL(url);

    // Handle the format: https://utfs.io/f/{fileKey}
    if (urlObj.pathname.startsWith("/f/")) {
      return urlObj.pathname.replace("/f/", "");
    }

    // Handle the format: https://utfs.io/a/{appId}/f/{fileKey}
    const match = urlObj.pathname.match(FILE_KEY_PATH_REGEX);
    if (match?.[1]) {
      return match[1];
    }

    return null;
  } catch (error) {
    console.error("Failed to extract file key from URL:", url, error);
    return null;
  }
}

/**
 * Extracts file keys from message parts that contain file attachments
 */
export function extractFileKeysFromMessages(
  messages: Array<{ parts: unknown }>
): string[] {
  const fileKeys: string[] = [];

  for (const message of messages) {
    if (!Array.isArray(message.parts)) {
      continue;
    }
    for (const part of message.parts) {
      if (
        typeof part === "object" &&
        part !== null &&
        "type" in part &&
        part.type === "file" &&
        "url" in part &&
        typeof part.url === "string"
      ) {
        const key = extractFileKey(part.url);
        if (key) {
          fileKeys.push(key);
        }
      }
    }
  }

  return fileKeys;
}

/**
 * Deletes files from UploadThing storage
 * Returns the count of successfully deleted files
 */
export async function deleteFilesFromUploadThing(
  fileKeys: string[]
): Promise<{ success: number; failed: number }> {
  if (fileKeys.length === 0) {
    return { success: 0, failed: 0 };
  }

  try {
    console.log(
      `Attempting to delete ${fileKeys.length} files from UploadThing`
    );

    const result = await utapi.deleteFiles(fileKeys);

    // Count successes and failures
    let success = 0;
    let failed = 0;

    if (Array.isArray(result)) {
      for (const item of result) {
        if (item.success) {
          success++;
        } else {
          failed++;
        }
      }
    } else if (result && typeof result === "object" && "success" in result) {
      success = result.success ? fileKeys.length : 0;
      failed = result.success ? 0 : fileKeys.length;
    }

    console.log(`Deleted ${success} files successfully, ${failed} failed`);
    return { success, failed };
  } catch (error) {
    console.error("Error deleting files from UploadThing:", error);
    return { success: 0, failed: fileKeys.length };
  }
}
