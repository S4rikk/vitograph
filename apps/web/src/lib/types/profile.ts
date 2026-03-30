export interface HealthGoal {
  id: string;
  title: string;
  category: string;
  is_active: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  health_goals?: HealthGoal[];
  [key: string]: any; // Allow other fields to exist without strict typing here
}
