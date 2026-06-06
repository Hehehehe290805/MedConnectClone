import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

function getS3Client() {
    if (!process.env.AWS_ACCESS_KEY_ID) throw new Error("AWS_ACCESS_KEY_ID is not set");
    if (!process.env.AWS_SECRET_ACCESS_KEY) throw new Error("AWS_SECRET_ACCESS_KEY is not set");
    if (!process.env.AWS_REGION) throw new Error("AWS_REGION is not set");
    if (!BUCKET()) throw new Error("AWS_BUCKET_NAME is not set");

    return new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    });
}

const BUCKET = () => process.env.AWS_BUCKET_NAME || process.env.AWS_S3_BUCKET;

// generates a unique S3 key for a file
function generateKey(folder, userId, originalName) {
    const ext = originalName.split(".").pop();
    const unique = crypto.randomBytes(8).toString("hex");
    return `${folder}/${userId}/${unique}.${ext}`;
}

// upload a file buffer to S3
// folder: "public/profilepics" | "private/licenses" | "private/permits" | "private/legalids"
export async function uploadToS3(fileBuffer, mimeType, folder, userId, originalName) {
    const client = getS3Client();
    const key = generateKey(folder, userId, originalName);

    await client.send(new PutObjectCommand({
        Bucket: BUCKET(),
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
    }));

    // for public files, return permanent URL directly
    if (folder.startsWith("public/")) {
        const url = `https://${BUCKET()}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
        return { url, key };
    }

    // for private files, return key only — URL is generated on demand
    return { url: "", key };
}

// delete a file from S3 by key
export async function deleteFromS3(key) {
    if (!key) return;
    const client = getS3Client();
    await client.send(new DeleteObjectCommand({
        Bucket: BUCKET(),
        Key: key,
    }));
}

// generate a signed URL for a private file — valid for 15 minutes
export async function getSignedFileUrl(key) {
    if (!key) throw new Error("No key provided");
    const client = getS3Client();
    const command = new GetObjectCommand({
        Bucket: BUCKET(),
        Key: key,
    });
    return getSignedUrl(client, command, { expiresIn: 900 }); // 900 seconds = 15 minutes
}
