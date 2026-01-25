import React from 'react';

/**
 * Get adaptive font size based on amount
 * Larger amounts get smaller fonts to fit better
 */
export const getAdaptiveFontSize = (amount: number): number => {
  if (amount >= 1_000_000_000_000) return 14; // >= 1 Triliun
  if (amount >= 1_000_000_000) return 15;      // 1-999 Miliar
  return 16;                                    // < 1 Miliar
};

/**
 * Format currency - NO abbreviations, full number with thousand separators
 */
export const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('id-ID');
};

/**
 * Calculate total allocated from budget items
 */
export const calculateTotalAllocated = (items: { allocated_amount: number }[]): number => {
  return items.reduce((sum, item) => sum + (item.allocated_amount || 0), 0);
};

/**
 * Calculate total realisasi from budget items
 */
export const calculateTotalRealisasi = (items: { realisasi_snapshot?: number }[]): number => {
  return items.reduce((sum, item) => sum + (item.realisasi_snapshot || 0), 0);
};

/**
 * Table header style - reusable for all budget tables
 */
export const tableHeaderStyle: React.CSSProperties = {
  padding: '14px 16px',
  textAlign: 'left',
  fontSize: '13px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: '#495057',
  borderBottom: '2px solid #dee2e6',
  borderRight: '1px solid #dee2e6',
};

/**
 * Table cell style - reusable for all budget tables
 */
export const tableCellStyle: React.CSSProperties = {
  padding: '14px 16px',
  fontSize: '14px',
  color: '#212529',
  borderRight: '1px solid #dee2e6',
};