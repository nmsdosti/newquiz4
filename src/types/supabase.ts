export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      anytime_participants: {
        Row: {
          completed_at: string | null
          created_at: string | null
          email: string | null
          id: string
          ip_address: string | null
          phone: string | null
          player_name: string
          score: number | null
          session_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          ip_address?: string | null
          phone?: string | null
          player_name: string
          score?: number | null
          session_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          ip_address?: string | null
          phone?: string | null
          player_name?: string
          score?: number | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anytime_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      anytime_quiz_answers: {
        Row: {
          created_at: string | null
          id: string
          is_correct: boolean
          option_id: string
          player_id: string
          question_id: string
          question_index: number
          session_id: string
          time_taken: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_correct?: boolean
          option_id: string
          player_id: string
          question_id: string
          question_index: number
          session_id: string
          time_taken?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          is_correct?: boolean
          option_id?: string
          player_id?: string
          question_id?: string
          question_index?: number
          session_id?: string
          time_taken?: number
        }
        Relationships: [
          {
            foreignKeyName: "anytime_quiz_answers_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anytime_quiz_answers_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "anytime_quiz_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anytime_quiz_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anytime_quiz_answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "anytime_quiz_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      anytime_quiz_players: {
        Row: {
          completed_at: string | null
          created_at: string | null
          email: string
          id: string
          ip_address: string
          phone: string | null
          player_name: string
          score: number
          session_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          email: string
          id?: string
          ip_address: string
          phone?: string | null
          player_name: string
          score?: number
          session_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          email?: string
          id?: string
          ip_address?: string
          phone?: string | null
          player_name?: string
          score?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anytime_quiz_players_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "anytime_quiz_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      anytime_quiz_sessions: {
        Row: {
          created_at: string | null
          game_pin: string
          host_id: string
          id: string
          quiz_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          game_pin: string
          host_id: string
          id?: string
          quiz_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          game_pin?: string
          host_id?: string
          id?: string
          quiz_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anytime_quiz_sessions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      email_queue: {
        Row: {
          content: string
          created_at: string | null
          error: string | null
          id: string
          sent_at: string | null
          status: string
          subject: string
          to_email: string
        }
        Insert: {
          content: string
          created_at?: string | null
          error?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          subject: string
          to_email: string
        }
        Update: {
          content?: string
          created_at?: string | null
          error?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          subject?: string
          to_email?: string
        }
        Relationships: []
      }
      game_answers: {
        Row: {
          created_at: string | null
          id: string
          is_correct: boolean
          option_id: string
          player_id: string
          question_id: string
          question_index: number
          session_id: string
          time_taken: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_correct?: boolean
          option_id: string
          player_id: string
          question_id: string
          question_index: number
          session_id: string
          time_taken?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          is_correct?: boolean
          option_id?: string
          player_id?: string
          question_id?: string
          question_index?: number
          session_id?: string
          time_taken?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_answers_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_answers_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      game_players: {
        Row: {
          created_at: string | null
          id: string
          player_name: string
          score: number
          session_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          player_name: string
          score?: number
          session_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          player_name?: string
          score?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_players_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      game_sessions: {
        Row: {
          created_at: string | null
          current_question_index: number | null
          game_mode: string | null
          game_pin: string
          host_id: string
          id: string
          quiz_id: string
          quiz_mode: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_question_index?: number | null
          game_mode?: string | null
          game_pin: string
          host_id: string
          id?: string
          quiz_id: string
          quiz_mode?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_question_index?: number | null
          game_mode?: string | null
          game_pin?: string
          host_id?: string
          id?: string
          quiz_id?: string
          quiz_mode?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_sessions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      options: {
        Row: {
          created_at: string | null
          id: string
          is_correct: boolean
          question_id: string
          text: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_correct?: boolean
          question_id: string
          text: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_correct?: boolean
          question_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_answers: {
        Row: {
          created_at: string | null
          id: string
          option_id: string
          player_id: string
          question_id: string
          question_index: number
          session_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          option_id: string
          player_id: string
          question_id: string
          question_index: number
          session_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          option_id?: string
          player_id?: string
          question_id?: string
          question_index?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_answers_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_answers_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "poll_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "poll_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_players: {
        Row: {
          created_at: string | null
          id: string
          player_name: string
          session_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          player_name: string
          session_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          player_name?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_players_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "poll_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_sessions: {
        Row: {
          created_at: string | null
          current_question_index: number | null
          game_pin: string
          host_id: string
          id: string
          quiz_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_question_index?: number | null
          game_pin: string
          host_id: string
          id?: string
          quiz_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_question_index?: number | null
          game_pin?: string
          host_id?: string
          id?: string
          quiz_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "poll_sessions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          created_at: string | null
          id: string
          quiz_id: string
          text: string
          time_limit: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          quiz_id: string
          text: string
          time_limit?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          quiz_id?: string
          text?: string
          time_limit?: number
        }
        Relationships: [
          {
            foreignKeyName: "questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          image: string | null
          is_admin: boolean | null
          is_approved: boolean | null
          name: string | null
          token_identifier: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          image?: string | null
          is_admin?: boolean | null
          is_approved?: boolean | null
          name?: string | null
          token_identifier: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          image?: string | null
          is_admin?: boolean | null
          is_approved?: boolean | null
          name?: string | null
          token_identifier?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
