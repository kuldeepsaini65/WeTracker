"""Seniors and their users.

A senior shares an invite code; users who join see the senior's categories and the senior can
view (not edit) everything they spend. Users without a senior are personal accounts.
"""
import secrets

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from .defaults import DEFAULT_CATEGORIES
from .models import Category, Expense, Profile

User = get_user_model()
CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  # no 0/O/1/I


def profile_of(user):
    # Reuse the instance cached on user.profile so changes are visible everywhere in the request.
    try:
        return user.profile
    except Profile.DoesNotExist:
        return Profile.objects.create(user=user)


def category_owner(user):
    """Whose category list this user works with: their senior's if they joined one, else their own."""
    return profile_of(user).senior or user


def categories_for(user):
    return Category.objects.filter(user=category_owner(user))


def team_user_ids(senior):
    """The senior plus everyone who joined them."""
    return [senior.id, *Profile.objects.filter(senior=senior).values_list('user_id', flat=True)]


def new_invite_code():
    while True:
        code = ''.join(secrets.choice(CODE_ALPHABET) for _ in range(8))
        if not Profile.objects.filter(invite_code=code).exists():
            return code


def ensure_default_categories(user):
    if not user.categories.exists():
        Category.objects.bulk_create([
            Category(user=user, name=name, icon=icon, color=color, keywords=kw, position=i)
            for i, (name, icon, color, kw) in enumerate(DEFAULT_CATEGORIES)
        ])


def _remap_categories(user, owner):
    """Point the user's expenses at `owner`'s categories with the same name; unmatched become uncategorized."""
    by_name = {c.name.lower(): c for c in Category.objects.filter(user=owner)}
    for expense in Expense.objects.filter(user=user, category__isnull=False).exclude(category__user=owner).select_related('category'):
        expense.category = by_name.get(expense.category.name.lower())
        expense.save(update_fields=['category', 'updated_at'])


class TeamError(Exception):
    pass


@transaction.atomic
def make_senior(user):
    profile = profile_of(user)
    if profile.senior_id:
        raise TeamError('Leave your senior before becoming a senior yourself.')
    profile.role = Profile.ROLE_SENIOR
    profile.invite_code = profile.invite_code or new_invite_code()
    profile.save()
    ensure_default_categories(user)
    return profile


@transaction.atomic
def join_senior(user, code):
    code = (code or '').strip().upper()
    senior_profile = Profile.objects.filter(invite_code=code, role=Profile.ROLE_SENIOR).select_related('user').first()
    if senior_profile is None:
        raise TeamError('That invite code is not valid.')
    profile = profile_of(user)
    if senior_profile.user_id == user.id:
        raise TeamError('You can\'t join your own team.')
    if profile.is_senior:
        raise TeamError('Seniors can\'t join another senior.')
    if profile.senior_id == senior_profile.user_id:
        return profile
    profile.senior = senior_profile.user
    profile.joined_at = timezone.now()
    profile.save()
    _remap_categories(user, senior_profile.user)
    user.categories.all().delete()  # the senior's list replaces the user's own
    return profile


@transaction.atomic
def leave_senior(user):
    profile = profile_of(user)
    if not profile.senior_id:
        return profile
    profile.senior = None
    profile.joined_at = None
    profile.save()
    ensure_default_categories(user)
    _remap_categories(user, user)
    return profile
