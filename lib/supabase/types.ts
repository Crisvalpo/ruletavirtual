export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export interface Database {
    public: {
        Tables: {
            players: {
                Row: {
                    id: string;
                    created_at: string;
                    google_id: string | null;
                    email: string;
                    current_nickname: string;
                    current_emoji: string;
                    is_guest: boolean;
                    total_plays: number;
                    total_wins: number;
                };
                Insert: {
                    id?: string;
                    created_at?: string;
                    google_id?: string | null;
                    email: string;
                    current_nickname: string;
                    current_emoji: string;
                    is_guest?: boolean;
                    total_plays?: number;
                    total_wins?: number;
                };
                Update: {
                    id?: string;
                    created_at?: string;
                    google_id?: string | null;
                    email?: string;
                    current_nickname?: string;
                    current_emoji?: string;
                    is_guest?: boolean;
                    total_plays?: number;
                    total_wins?: number;
                };
            };
            // TODO: Add other tables
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            [_ in never]: never;
        };
        Enums: {
            [_ in never]: never;
        };
    };
}
