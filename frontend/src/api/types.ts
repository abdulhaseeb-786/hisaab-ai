/**
 * Friendly names for the generated API types. Never hand-write a response shape:
 * regenerate with `npm run gen:api` after changing a backend schema.
 */
import type { components } from './schema';

type S = components['schemas'];

export type StoreProfile = S['StoreProfile'];
export type TodayActionsResponse = S['TodayActionsResponse'];
export type TodayAction = S['ActionItem'];
export type ActionType = TodayAction['action_type'];
export type Urgency = TodayAction['urgency'];
export type KpiSummary = S['KPISummary'];
export type KpiPeriod = KpiSummary['period'];

export type ProductList = S['ProductListResponse'];
export type Product = S['ProductResponse'];
export type ProductDetail = S['ProductDetailResponse'];
export type RiskLevel = Product['stockout_risk'];

export type ReorderPlan = S['ReorderPlanResponse'];
export type ReorderLine = S['PurchasePlanLine'];
export type Forecast = S['ForecastResponse'];
export type ForecastModel = Forecast['model_used'];

export type Insights = S['InsightsResponse'];
export type MarginSqueeze = S['MarginSqueezeItem'];
export type DeadStockItem = S['DeadStockItem'];

export type CreditSummary = S['CreditSummaryResponse'];
export type KhataCustomer = S['CustomerKhataItem'];
export type CustomerLedger = S['CustomerLedgerResponse'];
export type Payables = S['PayablesSummaryResponse'];
export type CashOutlook = S['CashOutlookResponse'];

export type ChatResponse = S['ChatResponse'];
export type ChatLanguage = S['ChatRequest']['language'];
export type ToolCall = S['ToolCallExecution'];
export type CsvPreview = S['CSVPreviewResponse'];
export type CsvCommit = S['CSVCommitResponse'];
export type ImportType = CsvPreview['import_type'];
