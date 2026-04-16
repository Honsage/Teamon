export type ChatParticipant = {
  id: number;
  is_admin?: boolean;
  role_title?: string;
  user: {
    id: number;
    username?: string;
    email: string;
    first_name?: string;
    last_name?: string;
    full_name: string;
    display_name: string;
  };
};

export type Chat = {
  id: number;
  chat_type: "private" | "group";
  name: string | null;
  unread_count?: number;
  has_unread_mention?: boolean;
  project_details: { name: string; description?: string } | null;
  last_message: {
    text: string;
    created_at: string;
    sender: { full_name: string } | null;
  } | null;
  participants: ChatParticipant[];
};

export type MessageAttachment = {
  id: number;
  file: string;
  filename: string;
  file_size: number;
  content_type: string;
  uploaded_at?: string;
};

export type Message = {
  id: number;
  chat: number;
  text: string;
  created_at: string;
  is_deleted?: boolean;
  reply_to?: number | null;
  reply_to_data?: {
    id: number;
    text: string;
    sender: {
      id: number;
      full_name: string;
      display_name?: string;
    };
  } | null;
  sender: {
    id: number;
    full_name: string;
    display_name: string;
  };
  attachments?: MessageAttachment[];
};

export type UserProfileForSearch = {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
};

export type AvailableUser = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  display_name: string;
};

