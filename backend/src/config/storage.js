import { BlobServiceClient } from "@azure/storage-blob";
import dotenv from "dotenv";

dotenv.config();

const connectionString =
    process.env.AZURE_STORAGE_URL;

const eventsContainerName =
    process.env.AZURE_STORAGE_EVENTS_CONTAINER_NAME;

const organizationContainerName =
    process.env.AZURE_STORAGE_ORGANIZATION_CONTAINER_NAME;


const blobServiceClient =
    BlobServiceClient.fromConnectionString(connectionString);

export const eventsContainerClient =
    blobServiceClient.getContainerClient(eventsContainerName);

export const organizationContainerClient =
    blobServiceClient.getContainerClient(organizationContainerName);