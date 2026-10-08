export interface MonthlySummaryDto {
    categoryName: string;
    totalAmount: number;
}

export interface BudgetComparisonDto {
    month: string;
    budgetLimit: number;
    actualSpent: number;
}

export interface AiAdvisorAdvice {
    id: string;
    title: string;
    content: string;
    type: "warning" | "success" | "info";
    createdAt: string;
}