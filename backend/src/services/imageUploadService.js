import { randomUUID } from "crypto";
import { extname } from "path";

// Uploads a multer file (in-memory buffer) to the given Azure container and
// returns the blob's URL, or undefined if no file was provided.
export const uploadImage = async (containerClient, file) => {
    if (!file) {
        return undefined;
    }
    const blobName = `${randomUUID()}${extname(file.originalname)}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.uploadData(file.buffer, {
        blobHTTPHeaders: { blobContentType: file.mimetype },
    });
    return blockBlobClient.url;
};

// Deletes the blob a previously-stored image_url points to. No-op if imageUrl
// is falsy or the blob is already gone.
export const deleteImage = async (containerClient, imageUrl) => {
    if (!imageUrl) {
        return;
    }
    const blobName = imageUrl.split("/").pop();
    await containerClient.getBlockBlobClient(blobName).deleteIfExists();
};

// TODO: before deployment, disable key access entirely and switch to Azure AD/managed-identity auth (DefaultAzureCredential), 
// which needs no long-lived secret at all — worth doing before this handles real user data in production, not necessary right now.

// TODO: Sas or auth token?