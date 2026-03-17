export type ChatParticipant = {
  id: number;
  user: {
    id: number;
    email: string;
    full_name: string;
    display_name: string;
  };
};

export type Chat = {
  id: number;
  chat_type: "private" | "group";
  name: string | null;
  project_details: { name: string } | null;
  last_message: {
    text: string;
    created_at: string;
    sender: { full_name: string } | null;
  } | null;
  participants: ChatParticipant[];
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

