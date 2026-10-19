import type { CreditSource } from './api'

export const CREDIT_SOURCES: { value: CreditSource; label: string; icon: string }[] = [
  { value: 'salary', label: 'Salary', icon: '💼' },
  { value: 'business', label: 'Business', icon: '🏪' },
  { value: 'freelance', label: 'Freelance', icon: '💻' },
  { value: 'gift', label: 'Gift', icon: '🎁' },
  { value: 'refund', label: 'Refund', icon: '↩️' },
  { value: 'interest', label: 'Interest', icon: '🏦' },
  { value: 'other', label: 'Other', icon: '💰' },
]

export function creditSource(value: CreditSource) {
  return CREDIT_SOURCES.find((s) => s.value === value) ?? CREDIT_SOURCES[CREDIT_SOURCES.length - 1]
}
