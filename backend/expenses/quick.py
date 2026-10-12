"""Parsing of one-line quick-add text such as "250 coffee", "uber 180 #travel" or "1.2k rent yesterday"."""
import re
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from typing import Optional

from django.utils import timezone

from .models import Category, Expense
from .teams import categories_for

AMOUNT_RE = re.compile(r'^(?:₹|\$|€|£|rs\.?|inr)?(\d+(?:[.,]\d{1,2})?)(k)?$', re.IGNORECASE)
WORD_RE = re.compile(r'[a-z0-9]+')
DAY_WORDS = {'today': 0, 'yesterday': 1, 'yday': 1}


@dataclass
class ParsedQuick:
    amount: Optional[Decimal]
    note: str
    category: Optional[Category]
    days_ago: int = 0


def _parse_amount(token):
    m = AMOUNT_RE.match(token)
    if not m:
        return None
    try:
        value = Decimal(m.group(1).replace(',', '.'))
    except InvalidOperation:
        return None
    if m.group(2):
        value *= 1000
    return value


def suggest_category(user, note, categories=None):
    """Best category guess for a note: same note used before, then keyword match. None if unsure."""
    note = (note or '').strip().lower()
    if not note:
        return None
    previous = (
        Expense.objects.filter(user=user, note__iexact=note, category__isnull=False)
        .select_related('category').order_by('-spent_at').first()
    )
    if previous:
        return previous.category

    categories = list(categories if categories is not None else categories_for(user))
    words = set(WORD_RE.findall(note))
    for cat in categories:
        for kw in cat.keyword_list:
            if (' ' in kw and kw in note) or kw in words:
                return cat
    for cat in categories:
        if cat.name.lower() in words:
            return cat
    return None


def parse_quick(user, text):
    categories = list(categories_for(user))
    by_name = {c.name.lower().replace(' ', ''): c for c in categories}

    amount = None
    category = None
    days_ago = 0
    note_tokens = []
    for token in text.split():
        low = token.lower()
        if amount is None:
            value = _parse_amount(low)
            if value is not None:
                amount = value
                continue
        if low.startswith('#') and len(low) > 1:
            tag = low[1:]
            category = by_name.get(tag) or next(
                (c for c in categories if c.name.lower().replace(' ', '').startswith(tag)), None)
            if category is not None:
                continue
        if low in DAY_WORDS:
            days_ago = DAY_WORDS[low]
            continue
        note_tokens.append(token)

    note = ' '.join(note_tokens).strip()
    if category is None:
        category = suggest_category(user, note, categories)
    return ParsedQuick(amount=amount, note=note, category=category, days_ago=days_ago)


def spent_at_for(days_ago):
    return timezone.now() - timedelta(days=days_ago)
