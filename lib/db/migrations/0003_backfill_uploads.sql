INSERT INTO "upload" ("key", "user_id", "url", "name", "media_type", "created_at")
SELECT DISTINCT ON (file_part."key")
	file_part."key",
	"chat"."user_id",
	file_part.part->>'url',
	coalesce(file_part.part->>'name', file_part."key"),
	coalesce(file_part.part->>'mediaType', 'application/octet-stream'),
	"message"."created_at"
FROM "message"
INNER JOIN "chat" ON "chat"."id" = "message"."chat_id"
CROSS JOIN LATERAL (
	SELECT part, substring(part->>'url' FROM '/f/([^/?#]+)') AS "key"
	FROM jsonb_array_elements("message"."parts") AS part
	WHERE part->>'type' = 'file'
) AS file_part
WHERE file_part."key" IS NOT NULL
ORDER BY file_part."key", "message"."created_at", "message"."id"
ON CONFLICT ("key") DO NOTHING;
