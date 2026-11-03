import { GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
    region: process.env.AWS_REGION,
});

export async function getSignedDownloadUrl(
    s3Key: string | null | undefined,
    expiresIn = 3600,
): Promise<string | null> {
    if (!s3Key) {
        return null;
    }

    const bucket = process.env.S3_BUCKET_NAME;
    const region = process.env.AWS_REGION;
    if (!bucket || !region) {
        throw new Error("AWS_REGION and S3_BUCKET_NAME must be configured.");
    }

    return getSignedUrl(
        s3,
        new GetObjectCommand({
            Bucket: bucket,
            Key: s3Key,
        }),
        { expiresIn },
    );
}

export type UploadedObjectCheck =
    | { ok: true; size: number }
    | { ok: false; reason: "missing" | "empty" | "too_large" };

/**
 * Confirms the browser's PUT actually landed in S3 before a credit is spent
 * and a worker job is queued for it.
 */
export async function checkUploadedObject(
    s3Key: string,
    maxBytes: number,
): Promise<UploadedObjectCheck> {
    const bucket = process.env.S3_BUCKET_NAME;
    if (!bucket || !process.env.AWS_REGION) {
        throw new Error("AWS_REGION and S3_BUCKET_NAME must be configured.");
    }

    try {
        const head = await s3.send(
            new HeadObjectCommand({ Bucket: bucket, Key: s3Key }),
        );
        const size = head.ContentLength ?? 0;
        if (size <= 0) return { ok: false, reason: "empty" };
        if (size > maxBytes) return { ok: false, reason: "too_large" };
        return { ok: true, size };
    } catch (error) {
        const name = (error as { name?: string } | null)?.name;
        const status = (error as { $metadata?: { httpStatusCode?: number } } | null)
            ?.$metadata?.httpStatusCode;
        if (name === "NotFound" || name === "NoSuchKey" || status === 404) {
            return { ok: false, reason: "missing" };
        }
        throw error;
    }
}
