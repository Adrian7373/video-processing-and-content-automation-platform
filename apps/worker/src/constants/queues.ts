export const queueNames = {
    media: "media-processing",
    legacyVideo: "video-processing",
    publishing: "social-publishing",
    // Alias for publishingWorker.ts
    socialPublishing: "social-publishing",
} as const;

export const jobNames = {
    processVideo: "process-video",
    transcribe: "transcribe",
    createCaption: "create-caption",
    createThumbnail: "create-thumbnail",
    publishSocial: "publish-social-post",
    // Alias for socialPublishProcessor.ts
    publishSocialPost: "publish-social-post",
} as const;

export type QueueName = (typeof queueNames)[keyof typeof queueNames];