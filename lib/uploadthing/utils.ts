import { utapi } from "./core";

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
          success += 1;
        } else {
          failed += 1;
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
