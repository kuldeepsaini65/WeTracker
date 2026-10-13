"""Bring existing accounts up to date with DEFAULT_CATEGORIES.

For every account that owns a category list (personal accounts and seniors):
  * missing default categories are created;
  * default categories get any new default keywords, keep the user's own extra keywords, and lose keywords
    that now belong to a different default category (or were retired) — so "first match wins" stays correct;
  * categories the user created themselves are never touched.

    python manage.py sync_default_categories --dry-run
    python manage.py sync_default_categories
"""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from expenses.defaults import DEFAULT_CATEGORIES
from expenses.models import Category, Profile

RENAMED = {'cigret': 'Cigarettes'}  # old name (lowercase) -> new default name
RETIRED_KEYWORDS = {'bla bla', 'advance', 'gas', 'cutting', 'ticket', 'bar', 'classic', 'vi'}


def _split(keywords):
    return [k.strip().lower() for k in keywords.split(',') if k.strip()]


class Command(BaseCommand):
    help = 'Add new default categories/keywords to existing accounts (never deletes user-created categories).'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Show what would change without saving.')

    def handle(self, *args, dry_run=False, **options):
        owner_of = {}  # default keyword -> default category name
        for name, _, _, kws in DEFAULT_CATEGORIES:
            for kw in _split(kws):
                owner_of[kw] = name

        owners = get_user_model().objects.exclude(
            id__in=Profile.objects.filter(senior__isnull=False).values('user_id'))
        changes = 0
        with transaction.atomic():
            for user in owners:
                cats = {c.name.lower(): c for c in Category.objects.filter(user=user)}
                last_pos = max((c.position for c in cats.values()), default=-1)
                for old, new in RENAMED.items():
                    if old in cats and new.lower() not in cats:
                        c = cats.pop(old)
                        self.stdout.write(f'{user.email}: rename "{c.name}" -> "{new}"')
                        c.name = new
                        cats[new.lower()] = c
                        changes += 1
                        if not dry_run:
                            c.save(update_fields=['name'])
                for name, icon, color, kws in DEFAULT_CATEGORIES:
                    defaults = _split(kws)
                    c = cats.get(name.lower())
                    if c is None:
                        last_pos += 1
                        self.stdout.write(f'{user.email}: add "{name}"')
                        changes += 1
                        if not dry_run:
                            Category.objects.create(user=user, name=name, icon=icon, color=color,
                                                    keywords=','.join(defaults), position=last_pos)
                        continue
                    extras = [k for k in _split(c.keywords)
                              if k not in defaults and k not in RETIRED_KEYWORDS and owner_of.get(k, name) == name]
                    merged = ','.join(defaults + extras)
                    if merged != ','.join(_split(c.keywords)):
                        removed = sorted(set(_split(c.keywords)) - set(defaults) - set(extras))
                        added = len(set(defaults) - set(_split(c.keywords)))
                        self.stdout.write(f'{user.email}: update "{c.name}" (+{added} keywords'
                                          + (f', removed {", ".join(removed)}' if removed else '') + ')')
                        changes += 1
                        if not dry_run:
                            c.keywords = merged
                            c.save(update_fields=['keywords'])
            if dry_run:
                transaction.set_rollback(True)
        self.stdout.write(self.style.SUCCESS(f'{"Would make" if dry_run else "Made"} {changes} changes.'))
