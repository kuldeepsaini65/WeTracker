from django.conf import settings
from django.db import models
from django.utils import timezone


class Profile(models.Model):
    ROLE_USER = 'user'
    ROLE_SENIOR = 'senior'
    ROLE_CHOICES = ((ROLE_USER, 'User'), (ROLE_SENIOR, 'Senior'))

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    currency = models.CharField(max_length=8, default='INR')
    monthly_budget = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default=ROLE_USER)
    # A user who joined a senior. The senior sees their expenses and owns the category list they use.
    senior = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                               related_name='member_profiles')
    joined_at = models.DateTimeField(null=True, blank=True)
    # Seniors only: code users enter to join.
    invite_code = models.CharField(max_length=12, unique=True, null=True, blank=True)

    @property
    def is_senior(self):
        return self.role == self.ROLE_SENIOR

    def __str__(self):
        return f'{self.user} ({self.currency})'


class Category(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='categories')
    name = models.CharField(max_length=50)
    icon = models.CharField(max_length=16, default='🏷️')
    color = models.CharField(max_length=9, default='#6366f1')
    # Comma separated words used to auto-detect this category in quick-add text.
    keywords = models.TextField(blank=True, default='')
    position = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('position', 'name')
        constraints = [models.UniqueConstraint(fields=('user', 'name'), name='unique_category_per_user')]
        verbose_name_plural = 'categories'

    def __str__(self):
        return self.name

    @property
    def keyword_list(self):
        return [k.strip().lower() for k in self.keywords.split(',') if k.strip()]


class Expense(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='expenses')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    note = models.CharField(max_length=200, blank=True, default='')
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='expenses')
    spent_at = models.DateTimeField(default=timezone.now, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # Client generated id so offline-queued expenses are never saved twice.
    client_id = models.CharField(max_length=64, blank=True, null=True)

    class Meta:
        ordering = ('-spent_at', '-id')
        constraints = [
            models.UniqueConstraint(fields=('user', 'client_id'), name='unique_client_id_per_user'),
        ]

    def __str__(self):
        return f'{self.amount} {self.note}'.strip()
