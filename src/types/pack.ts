// ============================================================================
// Pack Types
// ============================================================================

export interface BudgetAllocation {
  section: string;
  priority: 'Critical' | 'Important' | 'Reference';
  detailLevel: 'full' | 'summary' | 'reference' | 'dropped';
  estimatedTokens: number;
}
