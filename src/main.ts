import "dotenv/config";

const {
  RIPPLING_AUTH_KEY,
  RIPPLING_ROLE,
  RIPPLING_COMPANY,
  RIPPLING_BASE_PAY,
  OER_APP_ID,
} = process.env;

const RIPPLING_HEADERS = {
  authorization: `Bearer ${RIPPLING_AUTH_KEY}`,
  company: RIPPLING_COMPANY,
  role: RIPPLING_ROLE,
};

const RIPPLING_BASE_URL =
  "https://app.rippling.com/api/time_tracking/api/time_entry_period_summaries";
const OER_BASE_URL = "https://openexchangerates.org/api/latest.json";

interface OerReponse {
  base: string;
  timestamp: number;
  rates: Record<string, number>;
}

interface Ids {
  ids: string[];
  pageSize: number;
  supportsIdBasedPagination: boolean;
}

interface PayPeriod {
  _frequency: string | null;
  endDate: string;
  payFrequencyFactor: number;
  paySchedule: string | null;
  psEndDate: string;
  psStartDate: string;
  startDate: string;
}

interface JobCode {
  codes: {};
  hours: string;
}

interface Timecard {
  approved_hours: string;
  break_types: Record<string, { name: string }>;
  earning_types: Record<string, { name: string }>;
  earnings: Record<string, string>;
  entry_alerts: [];
  escalation_approvers: [];
  job_codes_with_names: JobCode[];
  job_codes: JobCode[];
  paid_hours: string;
  period_alerts: [];
  premiums: {};
  pto_accrual_bonus: string;
  signed_off_hours: string;
  total_escalated_entries: number;
  total_holiday_hours: string;
  total_hours: string;
  total_paid_time_off_hours: string;
  total_unpaid_time_off_hours: string;
}

interface TimeEntry {
  id: string;
  isDelete: boolean;
  createdAt: string;
  updatedAt: string;
  company: string;
  role: string;
  regularRun: boolean | null;
  timecardSummary: Timecard;
  payPeriod: PayPeriod;
}

const getUsdToInr = async (): Promise<number> => {
  const response = await fetch(`${OER_BASE_URL}?app_id=${OER_APP_ID}&base=USD`);
  const data = (await response.json()) as OerReponse;
  return data.rates["INR"];
};

const getRipplingUrl = (params: Record<string, any>, endpoint?: string) => {
  const url = new URL(`${RIPPLING_BASE_URL}/${endpoint ?? ""}`);
  Object.entries(params).forEach(([key, value]) =>
    url.searchParams.append(key, String(value))
  );
  return url;
};

const getIds = async (
  queryParams: Record<string, any>
): Promise<Ids["ids"]> => {
  const url = getRipplingUrl(queryParams, "getAllIdsAndPageSize");
  const response = await fetch(url.toString(), { headers: RIPPLING_HEADERS });
  const data = (await response.json()) as Ids;
  return data.ids;
};

const getTimesheet = async (
  queryParams: Record<string, any>,
  ids: string[]
): Promise<Timecard> => {
  const url = getRipplingUrl(queryParams);
  url.searchParams.append("ids", ids.join(","));
  const response = await fetch(url.toString(), { headers: RIPPLING_HEADERS });
  const data = (await response.json()) as TimeEntry[];
  return data[0].timecardSummary;
};

async function main() {
  const usdToInr = await getUsdToInr();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - startDate.getDay() + 1);
  const queryParams = {
    payPeriod__startDate: startDate.toISOString().slice(0, 10),
    payPeriod__paySchedule__exists: false,
    role: RIPPLING_ROLE,
    page: 1,
    page_size: 100,
    pagination_v2: true,
  };
  const ids = await getIds(queryParams);
  const data = await getTimesheet(queryParams, ids);
  const hours = Number(data.total_hours);
  const currentWeekPay = Number(RIPPLING_BASE_PAY) * hours;
  const currentWeekPayInr = Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(currentWeekPay * usdToInr);
  console.log(currentWeekPayInr);
}

main();
