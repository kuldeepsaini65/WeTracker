from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

router = DefaultRouter()
router.register('categories', views.CategoryViewSet, basename='category')
router.register('expenses', views.ExpenseViewSet, basename='expense')
router.register('team/expenses', views.TeamExpenseViewSet, basename='team-expense')

urlpatterns = [
    path('auth/register/', views.RegisterView.as_view(), name='register'),
    path('auth/login/', views.LoginView.as_view(), name='login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('auth/me/', views.MeView.as_view(), name='me'),
    path('stats/summary/', views.SummaryView.as_view(), name='stats-summary'),
    path('team/', views.TeamView.as_view(), name='team'),
    path('team/become-senior/', views.BecomeSeniorView.as_view(), name='team-become-senior'),
    path('team/regenerate-code/', views.RegenerateCodeView.as_view(), name='team-regenerate-code'),
    path('team/join/', views.JoinTeamView.as_view(), name='team-join'),
    path('team/leave/', views.LeaveTeamView.as_view(), name='team-leave'),
    path('team/members/<int:member_id>/', views.RemoveMemberView.as_view(), name='team-remove-member'),
    path('team/summary/', views.TeamSummaryView.as_view(), name='team-summary'),
    path('', include(router.urls)),
]
