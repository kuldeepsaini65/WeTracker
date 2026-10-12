from django.contrib import admin

from .models import Category, Expense, Profile


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'icon', 'user', 'position')
    list_filter = ('user',)


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ('spent_at', 'amount', 'note', 'category', 'user')
    list_filter = ('user', 'category')
    search_fields = ('note',)


admin.site.register(Profile)
