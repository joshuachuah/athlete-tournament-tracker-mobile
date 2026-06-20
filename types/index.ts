export type Sport = string;

export type SubsidyCovers =
  | "flights"
  | "accommodation"
  | "full_expenses"
  | "flat_stipend";

export type PrizeRounds = {
  r1?: number;
  r2?: number;
  r3?: number;
  qf?: number;
  sf?: number;
  f?: number;
  w?: number;
};

export type AthleteProfile = {
  id: string;
  email: string;
  name: string;
  home_country: string;
  home_currency: string;
  sport: Sport;
  monthly_income: number;
  savings_balance: number;
  monthly_sponsorship: number;
  created_at: string;
};

export type Tournament = {
  id: string;
  user_id: string;
  name: string;
  location: string;
  country: string;
  currency: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  entry_fee: number;
  flight_cost: number;
  accommodation_total: number;
  daily_spending_cap: number;
  coaching_cost: number;
  misc_cost: number;
  subsidy_by: string | null;
  subsidy_amount: number;
  subsidy_covers: SubsidyCovers | null;
  sponsorship_allocated: number;
  prize_rounds: PrizeRounds;
  prize_tax_rate: number;
  created_at: string;
};

export type Scenario = "worst" | "realistic" | "best";

export type ScenarioResult = {
  scenario: Scenario;
  round: keyof PrizeRounds;
  prize_money: number;
  prize_money_after_tax: number;
  net_result: number;
  profitable: boolean;
};

export type PnLResult = {
  total_expenses: number;
  total_income_base: number;
  scenarios: ScenarioResult[];
  break_even_round: keyof PrizeRounds | null;
};

export type TournamentWithPnL = Tournament & {
  pnl: PnLResult;
  home_currency: string;
};

export type KnownTournament = {
  id?: string;
  name: string;
  location?: string;
  country?: string;
  currency?: string;
  start_date?: string;
  end_date?: string;
  duration_days?: number;
  tier?: string;
  tour_level?: string;
  estimated_prize_total?: number;
  prize_rounds?: PrizeRounds;
  prize_tax_rate?: number;
};
