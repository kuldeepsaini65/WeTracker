"""Balance = opening balance + credits − expenses, all counted from the moment balance tracking started."""
from decimal import Decimal

from django.db.models import Sum

from .models import Credit, Expense
from .teams import profile_of


def balance_for(user):
    profile = profile_of(user)
    since = profile.balance_start
    credits = Credit.objects.filter(user=user)
    expenses = Expense.objects.filter(user=user)
    if since is not None:
        credits = credits.filter(received_at__gte=since)
        expenses = expenses.filter(spent_at__gte=since)
    credit_total = credits.aggregate(t=Sum('amount'))['t'] or Decimal('0')
    expense_total = expenses.aggregate(t=Sum('amount'))['t'] or Decimal('0')
    opening = profile.opening_balance or Decimal('0')
    return {
        'enabled': profile.balance_tracking,
        'since': since,
        'opening_balance': opening,
        'credits': credit_total,
        'expenses': expense_total,
        'balance': opening + credit_total - expense_total,
    }
