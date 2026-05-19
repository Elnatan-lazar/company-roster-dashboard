// Types matching the Supabase schema (hand-maintained)

export type UserRole = 'company_commander' | 'platoon_commander' | 'crew_commander' | 'soldier';
export type CrewPosition = 'commander' | 'gunner' | 'loader' | 'driver';
export type SoldierStatus = 'available' | 'leave' | 'mission' | 'sick';
export type RequestStatus = 'pending' | 'approved' | 'rejected';

// ── Armor Corps UI roles (display only — maps to UserRole + CrewPosition) ────
export type ArmorRole =
  | 'officer'         // קצין
  | 'tank_commander'  // מט"ק
  | 'gunner'          // תותחן
  | 'loader'          // טען
  | 'driver'          // נהג
  | 'technical'       // חוליה טכנית
  | 'sergeant';       // מפלג

export const ARMOR_ROLE_LABELS: Record<ArmorRole, string> = {
  officer:       'קצין',
  tank_commander: 'מט"ק',
  gunner:        'תותחן',
  loader:        'טען',
  driver:        'נהג',
  technical:     'חוליה טכנית',
  sergeant:      'מפלג',
};

export const ARMOR_ROLE_TO_DB: Record<ArmorRole, { role: UserRole; crew_position: CrewPosition | null }> = {
  officer:        { role: 'platoon_commander', crew_position: null },
  tank_commander: { role: 'crew_commander',    crew_position: 'commander' },
  gunner:         { role: 'soldier',           crew_position: 'gunner' },
  loader:         { role: 'soldier',           crew_position: 'loader' },
  driver:         { role: 'soldier',           crew_position: 'driver' },
  technical:      { role: 'soldier',           crew_position: null },
  sergeant:       { role: 'platoon_commander', crew_position: null },
};

// Hebrew display labels for enum values
export const ROLE_LABELS: Record<UserRole, string> = {
  company_commander: 'מפקד פלוגה',
  platoon_commander: 'מפקד מחלקה',
  crew_commander:    'מפקד צוות',
  soldier:           'חייל',
};

export const POSITION_LABELS: Record<CrewPosition, string> = {
  commander: 'מפקד',
  gunner:    'תותחן',
  loader:    'טען',
  driver:    'נהג',
};

export const STATUS_LABELS: Record<SoldierStatus, string> = {
  available: 'זמין',
  leave:     'חופשה',
  mission:   'משימה',
  sick:      'חולה',
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  pending:  'ממתין',
  approved: 'אושר',
  rejected: 'נדחה',
};

// Database row types
export interface Database {
  public: {
    Tables: {
      users: {
        Row: UserRow;
        Insert: Omit<UserRow, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<UserRow, 'id' | 'created_at'>>;
      };
      platoons: {
        Row: PlatoonRow;
        Insert: Omit<PlatoonRow, 'id' | 'created_at'>;
        Update: Partial<Omit<PlatoonRow, 'id' | 'created_at'>>;
      };
      crews: {
        Row: CrewRow;
        Insert: Omit<CrewRow, 'id' | 'created_at'>;
        Update: Partial<Omit<CrewRow, 'id' | 'created_at'>>;
      };
      feedback: {
        Row: FeedbackRow;
        Insert: Omit<FeedbackRow, 'id' | 'created_at'>;
        Update: Partial<Omit<FeedbackRow, 'id' | 'created_at'>>;
      };
      absence_requests: {
        Row: AbsenceRequestRow;
        Insert: Omit<AbsenceRequestRow, 'id' | 'created_at'>;
        Update: Partial<Omit<AbsenceRequestRow, 'id' | 'created_at'>>;
      };
      email_whitelist: {
        Row: EmailWhitelistRow;
        Insert: Omit<EmailWhitelistRow, 'id' | 'created_at'>;
        Update: Partial<Omit<EmailWhitelistRow, 'id' | 'created_at'>>;
      };
      deployment_configs: {
        Row: DeploymentConfig;
        Insert: Omit<DeploymentConfig, 'id' | 'created_at'>;
        Update: Partial<Omit<DeploymentConfig, 'id' | 'created_at'>>;
      };
      deployment_assignments: {
        Row: DeploymentAssignment;
        Insert: Omit<DeploymentAssignment, 'created_at'>;
        Update: Partial<Omit<DeploymentAssignment, 'config_id' | 'user_id' | 'created_at'>>;
      };
    };
    Functions: {
      get_my_role: { Returns: UserRole };
      get_my_platoon_id: { Returns: string };
      get_available_soldiers_for_position: {
        Args: { p_position: CrewPosition; p_platoon_id: string };
        Returns: AvailableSoldierRow[];
      };
    };
  };
}

export interface UserRow {
  id:                        string;
  personal_id:               string;
  email:                     string;
  first_name:                string;
  last_name:                 string;
  phone_number:              string | null;
  role:                      UserRole;
  primary_platoon_id:        string | null;
  crew_id:                   string | null;
  crew_position:             CrewPosition | null;
  status:                    SoldierStatus;
  medical_fitness:           boolean;
  medical_fitness_notes:     string | null;
  shooting_qualification_date: string | null;
  is_backup_in_crew_id:      string | null;
  can_edit_roster:           boolean;
  can_view_feedback:         boolean;
  is_admin:                  boolean;
  created_at:                string;
  updated_at:                string;
}

export interface PlatoonRow {
  id:             string;
  name:           string;
  platoon_number: number;
  commander_id:   string | null;
  created_at:     string;
}

export interface CrewRow {
  id:           string;
  name:         string;
  platoon_id:   string | null;
  commander_id: string | null;
  vehicle_id:   string | null;
  created_at:   string;
}

export interface FeedbackRow {
  id:          string;
  author_id:   string;
  soldier_id:  string;
  content:     string;
  is_private:  boolean;
  created_at:  string;
}

export interface AbsenceRequestRow {
  id:            string;
  soldier_id:    string;
  request_type:  SoldierStatus;
  start_date:    string;
  end_date:      string;
  reason:        string | null;
  status:        RequestStatus;
  reviewed_by:   string | null;
  reviewed_at:   string | null;
  created_at:    string;
}

export interface EmailWhitelistRow {
  id:         string;
  email:      string;
  added_by:   string | null;
  created_at: string;
}

export interface AvailableSoldierRow {
  id:           string;
  personal_id:  string;
  first_name:   string;
  last_name:    string;
  phone_number: string | null;
  status:       SoldierStatus;
  is_backup:    boolean;
}

// ── Deployment Configuration System ───────────────────────────

export interface DeploymentConfig {
  id:         string;
  name:       string;
  created_at: string;
}

export interface DeploymentAssignment {
  config_id:      string;
  user_id:        string;
  crew_id:        string | null;
  position_label: string;
  created_at:     string;
}

export interface Warning {
  id:      string;
  type:    'empty_crew' | 'incomplete' | 'no_commander' | 'no_qual' | 'expired_qual';
  message: string;
  crewId?: string;
  userId?: string;
}

export interface FeedbackWithAuthor extends FeedbackRow {
  author_first_name: string;
  author_last_name:  string;
}

// ── Leave Requests ─────────────────────────────────────────────
export interface LeaveRequest {
  id:          string;
  soldier_id:  string;
  start_date:  string;
  end_date:    string;
  leave_time:  string | null;
  reason:      string | null;
  status:      'pending' | 'approved';
  approved_by: string | null;
  approved_at: string | null;
  created_at:  string;
  // Enriched by API join:
  soldier_name?: string;
  platoon_id?:   string | null;
}

// ── Activity Logs ──────────────────────────────────────────────
export interface ActivityLog {
  id:         string;
  action:     string;
  actor_id:   string | null;
  target_id:  string | null;
  details:    Record<string, unknown> | null;
  created_at: string;
  // Enriched by API:
  actor_name?: string;
}

// ── Company Settings ───────────────────────────────────────────
export interface CompanySettings {
  id:                  string;
  combat_crews_target: number;
  tech_members_target: number;
  spare_commanders:    number;
  spare_gunners:       number;
  spare_loaders:       number;
  spare_drivers:       number;
  updated_at:          string;
}
