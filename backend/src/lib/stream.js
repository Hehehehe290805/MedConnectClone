import { StreamChat } from "stream-chat";
import "dotenv/config";

const apiKey = process.env.STREAM_API_KEY;
const apiSecret = process.env.STREAM_API_SECRET;

if (!apiKey || !apiSecret) {
  console.error("Stream API key or Secret is missing");
}

const streamClient = StreamChat.getInstance(apiKey, apiSecret);

export const upsertStreamUser = async (userData) => {
  try {
    await streamClient.upsertUsers([userData]);
    return userData;
  } catch (error) {
    console.error("Error upserting Stream user:", error);
  }
};

export const generateStreamToken = (userId) => {
  try {
    const userIdStr = userId.toString();
    return streamClient.createToken(userIdStr);
  } catch (error) {
    console.error("Error generating Stream token:", error);
  }
};

// Returns file/image attachments from the messaging channel between two users.
// Channel ID is deterministic: the two user IDs sorted and joined with "-".
export const getChannelAttachments = async (userId1, userId2) => {
  try {
    const channelId = [userId1.toString(), userId2.toString()].sort().join("-");
    const channel = streamClient.channel("messaging", channelId);
    const result = await channel.query({ messages: { limit: 500 } });
    return (result.messages || [])
      .flatMap(m =>
        (m.attachments || []).map(a => ({
          type:       a.type,
          title:      a.title || a.fallback || "file",
          url:        a.image_url || a.asset_url || a.thumb_url || "",
          mimeType:   a.mime_type || "",
          sentAt:     m.created_at,
          senderName: m.user?.name || "User",
        }))
      )
      .filter(a => (a.type === "image" || a.type === "file") && a.url);
  } catch {
    return [];
  }
};