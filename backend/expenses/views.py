from datetime import datetime, time, timedelta, timezone as dt_timezone
from decimal import Decimal

from django.contrib.auth import authenticate, get_user_model
from django.db import IntegrityError, transaction
from django.db.models import Count, Max, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django_filters import rest_framework as filters
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import generics, permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

try:
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
except ImportError:  # pragma: no cover
    from backports.zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from .models import Category, Expense
from .quick import parse_quick, spent_at_for, suggest_category
from .serializers import (
    BulkCategorizeSerializer, CategoryBriefSerializer, CategorySerializer, ExpenseSerializer,
    FrequentExpenseSerializer, JoinTeamSerializer, MeSerializer, QuickAddSerializer,
    QuickParseResponseSerializer, RegisterSerializer, SummarySerializer, TeamExpenseSerializer, TeamSerializer,
    TeamSummarySerializer,
)
from .teams import (
    TeamError, categories_for, category_owner, delete_account, join_senior, leave_senior, make_senior, new_invite_code, profile_of,
    team_user_ids,
)


User = get_user_model()

def _tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return {'refresh': str(refresh), 'access': str(refresh.access_token)}


AuthResponse = inline_serializer('AuthResponse', {
    'refresh': serializers.CharField(),
    'access': serializers.CharField(),
    'user': MeSerializer(),
})


# ---------- Auth ----------

class EmailTokenSerializer(TokenObtainPairSerializer):
    username_field = 'email'

    def validate(self, attrs):
        email = attrs['email'].strip().lower()
        # Accounts made with createsuperuser / the admin may have a username that isn't the email.
        match = User.objects.filter(email__iexact=email).order_by('id').first()
        user = authenticate(self.context.get('request'),
                            username=match.username if match else email, password=attrs['password'])
        if user is None or not user.is_active:
            raise AuthenticationFailed('Invalid email or password.')
        return {**_tokens_for(user), 'user': MeSerializer(user).data}


@extend_schema(tags=['auth'], responses=AuthResponse)
class LoginView(TokenObtainPairView):
    """Log in with email + password. Returns JWT access/refresh tokens."""
    serializer_class = EmailTokenSerializer


@extend_schema(tags=['auth'], responses={201: AuthResponse})
class RegisterView(generics.CreateAPIView):
    """Create an account. Default categories are created automatically."""
    serializer_class = RegisterSerializer
    permission_classes = (permissions.AllowAny,)
    authentication_classes = ()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response({**_tokens_for(user), 'user': MeSerializer(user).data}, status=status.HTTP_201_CREATED)


@extend_schema(tags=['auth'])
class MeView(generics.RetrieveUpdateAPIView):
    """Current user profile and settings (currency, monthly budget)."""
    serializer_class = MeSerializer
    http_method_names = ('get', 'patch')

    def get_object(self):
        return self.request.user


class DeleteAccountView(APIView):
    @extend_schema(
        tags=['auth'], responses={204: None},
        request=inline_serializer('DeleteAccountRequest', {'password': serializers.CharField()}),
    )
    def post(self, request):
        """Permanently delete your account, expenses and categories. Requires your password.
        If you're a senior, your users are released from your team (their data is kept)."""
        if not request.user.check_password(request.data.get('password') or ''):
            raise ValidationError({'password': 'Wrong password.'})
        delete_account(request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------- Categories ----------

@extend_schema(tags=['categories'])
class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.none()
    serializer_class = CategorySerializer
    pagination_class = None

    def get_queryset(self):
        return categories_for(self.request.user)

    def check_permissions(self, request):
        super().check_permissions(request)
        if request.method not in permissions.SAFE_METHODS and category_owner(request.user) != request.user:
            raise PermissionDenied('Categories are managed by your senior.')

    def perform_create(self, serializer):
        last = self.get_queryset().order_by('-position').first()
        serializer.save(user=self.request.user, position=(last.position + 1) if last else 0)

    @extend_schema(parameters=[OpenApiParameter('note', str, required=True)],
                   responses=CategoryBriefSerializer)
    @action(detail=False, methods=['get'])
    def suggest(self, request):
        """Guess a category for a note. Returns `null` when there is no confident guess."""
        category = suggest_category(request.user, request.query_params.get('note', ''))
        return Response(CategoryBriefSerializer(category).data if category else None)


# ---------- Expenses ----------

class ExpenseFilter(filters.FilterSet):
    start = filters.IsoDateTimeFilter(field_name='spent_at', lookup_expr='gte')
    end = filters.IsoDateTimeFilter(field_name='spent_at', lookup_expr='lt')
    uncategorized = filters.BooleanFilter(field_name='category', lookup_expr='isnull')
    min_amount = filters.NumberFilter(field_name='amount', lookup_expr='gte')
    max_amount = filters.NumberFilter(field_name='amount', lookup_expr='lte')

    class Meta:
        model = Expense
        fields = ('category', 'start', 'end', 'uncategorized', 'min_amount', 'max_amount')


@extend_schema(tags=['expenses'])
class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.none()
    serializer_class = ExpenseSerializer
    filterset_class = ExpenseFilter
    search_fields = ('note',)
    ordering_fields = ('spent_at', 'amount', 'created_at')

    def get_queryset(self):
        return Expense.objects.filter(user=self.request.user).select_related('category')

    def create(self, request, *args, **kwargs):
        # Idempotent on client_id so retried offline submissions don't duplicate.
        client_id = request.data.get('client_id')
        if client_id:
            existing = self.get_queryset().filter(client_id=client_id).first()
            if existing:
                return Response(self.get_serializer(existing).data, status=status.HTTP_200_OK)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        data = serializer.validated_data
        if 'category' not in data and data.get('note'):
            data['category'] = suggest_category(self.request.user, data['note'])
        try:
            with transaction.atomic():
                serializer.save(user=self.request.user)
        except IntegrityError:
            raise ValidationError({'client_id': 'Duplicate client_id.'})

    @extend_schema(request=QuickAddSerializer, responses={201: ExpenseSerializer})
    @action(detail=False, methods=['post'])
    def quick(self, request):
        """Create an expense from one line of text.

        Examples: `250 coffee`, `coffee 250`, `uber 180 #transport`, `1.2k rent yesterday`, `₹99 netflix`.
        The first number is the amount, `#tag` picks a category, `today`/`yesterday` set the date.
        Without a tag, the category is guessed from past expenses and category keywords —
        otherwise the expense is saved as uncategorized.
        """
        s = QuickAddSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        client_id = s.validated_data.get('client_id') or None
        if client_id:
            existing = self.get_queryset().filter(client_id=client_id).first()
            if existing:
                return Response(ExpenseSerializer(existing, context={'request': request}).data)
        parsed = parse_quick(request.user, s.validated_data['text'])
        if parsed.amount is None or parsed.amount <= 0:
            raise ValidationError({'text': 'Could not find an amount. Try something like "250 coffee".'})
        expense = Expense.objects.create(
            user=request.user, amount=parsed.amount, note=parsed.note[:200], category=parsed.category,
            spent_at=spent_at_for(parsed.days_ago), client_id=client_id,
        )
        return Response(ExpenseSerializer(expense, context={'request': request}).data,
                        status=status.HTTP_201_CREATED)

    @extend_schema(request=QuickAddSerializer, responses=QuickParseResponseSerializer)
    @action(detail=False, methods=['post'], url_path='quick/preview')
    def quick_preview(self, request):
        """Parse quick-add text without saving (for live previews while typing)."""
        s = QuickAddSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        parsed = parse_quick(request.user, s.validated_data['text'])
        return Response(QuickParseResponseSerializer({
            'amount': parsed.amount, 'note': parsed.note,
            'category': parsed.category, 'days_ago': parsed.days_ago,
        }).data)

    @extend_schema(request=BulkCategorizeSerializer,
                   responses=inline_serializer('BulkCategorizeResponse', {'updated': serializers.IntegerField()}))
    @action(detail=False, methods=['post'], url_path='bulk-categorize')
    def bulk_categorize(self, request):
        """Set (or clear) the category of many expenses at once."""
        s = BulkCategorizeSerializer(data=request.data, context={'request': request})
        s.is_valid(raise_exception=True)
        updated = self.get_queryset().filter(id__in=s.validated_data['ids']).update(
            category=s.validated_data['category'], updated_at=timezone.now())
        return Response({'updated': updated})

    @extend_schema(responses=FrequentExpenseSerializer(many=True),
                   parameters=[OpenApiParameter('limit', int, description='Max items (default 8)')])
    @action(detail=False, methods=['get'])
    def frequent(self, request):
        """Most repeated expenses (same note, amount and category) in the last 90 days — for one-tap re-adding."""
        try:
            limit = min(max(int(request.query_params.get('limit', 8)), 1), 30)
        except ValueError:
            limit = 8
        since = timezone.now() - timedelta(days=90)
        rows = (
            Expense.objects.filter(user=request.user, spent_at__gte=since).exclude(note='')
            .values('note', 'amount', 'category').annotate(count=Count('id'))
            .order_by('-count')[:limit]
        )
        cats = {c.id: c for c in categories_for(request.user)}
        data = [{'note': r['note'], 'amount': r['amount'], 'category': cats.get(r['category']), 'count': r['count']}
                for r in rows]
        return Response(FrequentExpenseSerializer(data, many=True).data)


# ---------- Stats ----------

# Old names browsers still report, but which newer tz databases (e.g. Ubuntu 24.04 without tzdata-legacy) drop.
TZ_ALIASES = {
    'Asia/Calcutta': 'Asia/Kolkata', 'Asia/Katmandu': 'Asia/Kathmandu', 'Asia/Saigon': 'Asia/Ho_Chi_Minh',
    'Asia/Rangoon': 'Asia/Yangon', 'Asia/Dacca': 'Asia/Dhaka', 'Asia/Thimbu': 'Asia/Thimphu',
    'Asia/Ulan_Bator': 'Asia/Ulaanbaatar', 'Asia/Macao': 'Asia/Macau', 'Europe/Kiev': 'Europe/Kyiv',
    'America/Buenos_Aires': 'America/Argentina/Buenos_Aires', 'Atlantic/Faeroe': 'Atlantic/Faroe',
    'Pacific/Truk': 'Pacific/Chuuk', 'Pacific/Ponape': 'Pacific/Pohnpei', 'US/Eastern': 'America/New_York',
    'US/Central': 'America/Chicago', 'US/Mountain': 'America/Denver', 'US/Pacific': 'America/Los_Angeles',
}


def _zone(name):
    """IANA zone for daily buckets. Never fails a request: unknown names fall back to UTC."""
    if not name:
        return dt_timezone.utc
    for candidate in (name, TZ_ALIASES.get(name)):
        if not candidate:
            continue
        try:
            return ZoneInfo(candidate)
        except (ZoneInfoNotFoundError, ValueError):
            continue
    return dt_timezone.utc


def _parse_dt(value, name):
    dt = parse_datetime(value)
    if dt is None:
        raise ValidationError({name: 'Use an ISO 8601 datetime, e.g. 2026-10-01T00:00:00+05:30.'})
    return dt if timezone.is_aware(dt) else timezone.make_aware(dt, dt_timezone.utc)


PERIOD_PARAMS = [
    OpenApiParameter('start', OpenApiTypes.DATETIME, description='Inclusive. Default: start of current month'),
    OpenApiParameter('end', OpenApiTypes.DATETIME, description='Exclusive. Default: start of next month'),
    OpenApiParameter('tz', str, description='IANA time zone for daily buckets, e.g. Asia/Kolkata'),
]


def _period(request):
    tz = _zone(request.query_params.get('tz'))
    if 'start' in request.query_params:
        start = _parse_dt(request.query_params['start'], 'start')
    else:
        today = timezone.now().astimezone(tz).date()
        start = datetime.combine(today.replace(day=1), time.min, tzinfo=tz)
    if 'end' in request.query_params:
        end = _parse_dt(request.query_params['end'], 'end')
    else:
        local_start = start.astimezone(tz)
        nm = (local_start.replace(day=28) + timedelta(days=4)).replace(day=1)
        end = datetime.combine(nm.date(), time.min, tzinfo=tz)
    if end <= start:
        raise ValidationError({'end': 'end must be after start.'})
    return start, end, tz


def _summary(base, categories, start, end, tz):
    qs = base.filter(spent_at__gte=start, spent_at__lt=end)
    agg = qs.aggregate(total=Sum('amount'), count=Count('id'))
    prev_total = base.filter(spent_at__gte=start - (end - start), spent_at__lt=start).aggregate(
        t=Sum('amount'))['t'] or Decimal('0')
    cats = {c.id: c for c in categories}
    by_category = [
        {'category': cats.get(r['category']), 'total': r['total'], 'count': r['count']}
        for r in qs.values('category').annotate(total=Sum('amount'), count=Count('id')).order_by('-total')
    ]
    daily = list(
        qs.annotate(date=TruncDate('spent_at', tzinfo=tz)).values('date')
        .annotate(total=Sum('amount')).order_by('date')
    )
    return {
        'start': start, 'end': end,
        'total': agg['total'] or Decimal('0'), 'count': agg['count'],
        'uncategorized_count': base.filter(category__isnull=True).count(),
        'previous_total': prev_total,
        'by_category': by_category, 'daily': daily,
    }, qs


class SummaryView(APIView):
    @extend_schema(tags=['stats'], responses=SummarySerializer, parameters=PERIOD_PARAMS)
    def get(self, request):
        """Your totals for a period: overall, per category, per day, and the previous period of equal length."""
        start, end, tz = _period(request)
        data, _ = _summary(Expense.objects.filter(user=request.user), categories_for(request.user), start, end, tz)
        return Response(SummarySerializer(data).data)


# ---------- Team (seniors and their users) ----------


def _require_senior(user):
    if not profile_of(user).is_senior:
        raise PermissionDenied('Only seniors can view team data.')


def _team_payload(user, month_start=None):
    profile = profile_of(user)
    members = []
    if profile.is_senior:
        if month_start is None:
            month_start = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        members = list(
            User.objects.filter(id__in=team_user_ids(user)).select_related('profile').annotate(
                month_total=Sum('expenses__amount', filter=Q(expenses__spent_at__gte=month_start)),
                month_count=Count('expenses', filter=Q(expenses__spent_at__gte=month_start)),
                uncategorized_count=Count('expenses', filter=Q(expenses__category__isnull=True)),
                last_spent_at=Max('expenses__spent_at'),
            ).order_by('first_name', 'email')
        )
        for m in members:
            m.month_total = m.month_total or Decimal('0')
            m.is_senior = m.id == user.id
    return {'role': profile.role, 'invite_code': profile.invite_code, 'senior': profile.senior, 'members': members}


class TeamView(APIView):
    @extend_schema(tags=['team'], responses=TeamSerializer, parameters=[
        OpenApiParameter('start', OpenApiTypes.DATETIME, description="Start of the viewer's current month"),
        OpenApiParameter('tz', str, description='IANA time zone, used when start is not given'),
    ])
    def get(self, request):
        """Seniors: invite code and every member with this month's totals.
        Users: the senior they belong to (if any).

        Pass `start` (the start of the month in the viewer's local time, ISO 8601) or `tz` so "this month"
        matches the viewer's calendar; otherwise the UTC month is used."""
        return Response(TeamSerializer(_team_payload(request.user, _month_start(request))).data)


def _month_start(request):
    if request.query_params.get('start'):
        return _parse_dt(request.query_params['start'], 'start')
    tz = _zone(request.query_params.get('tz'))
    today = timezone.now().astimezone(tz).date()
    return datetime.combine(today.replace(day=1), time.min, tzinfo=tz)


class BecomeSeniorView(APIView):
    @extend_schema(tags=['team'], request=None, responses=TeamSerializer)
    def post(self, request):
        """Turn this account into a senior and get an invite code."""
        try:
            make_senior(request.user)
        except TeamError as e:
            raise ValidationError({'detail': str(e)})
        return Response(TeamSerializer(_team_payload(request.user)).data)


class RegenerateCodeView(APIView):
    @extend_schema(tags=['team'], request=None, responses=TeamSerializer)
    def post(self, request):
        """Replace the invite code (the old one stops working; existing members stay)."""
        _require_senior(request.user)
        profile = profile_of(request.user)
        profile.invite_code = new_invite_code()
        profile.save(update_fields=['invite_code'])
        return Response(TeamSerializer(_team_payload(request.user)).data)


class JoinTeamView(APIView):
    @extend_schema(tags=['team'], request=JoinTeamSerializer, responses=MeSerializer)
    def post(self, request):
        """Join a senior with their invite code. Your expenses are matched to the senior's categories by name;
        any without a match become uncategorized."""
        s = JoinTeamSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            join_senior(request.user, s.validated_data['code'])
        except TeamError as e:
            raise ValidationError({'code': str(e)})
        return Response(MeSerializer(request.user).data)


class LeaveTeamView(APIView):
    @extend_schema(tags=['team'], request=None, responses=MeSerializer)
    def post(self, request):
        """Leave your senior. You get your own default categories back."""
        leave_senior(request.user)
        return Response(MeSerializer(request.user).data)


class RemoveMemberView(APIView):
    @extend_schema(tags=['team'], responses={204: None})
    def delete(self, request, member_id):
        """Remove a user from your team."""
        _require_senior(request.user)
        member = User.objects.filter(id=member_id, profile__senior=request.user).first()
        if member is None:
            raise ValidationError({'detail': 'Not a member of your team.'})
        leave_senior(member)
        return Response(status=status.HTTP_204_NO_CONTENT)


class TeamExpenseFilter(ExpenseFilter):
    member = filters.NumberFilter(field_name='user_id')

    class Meta(ExpenseFilter.Meta):
        fields = ExpenseFilter.Meta.fields + ('member',)


@extend_schema(tags=['team'])
class TeamExpenseViewSet(viewsets.ReadOnlyModelViewSet):
    """Every expense from you and your users (read-only). Filter with `member=<user id>`."""
    queryset = Expense.objects.none()
    serializer_class = TeamExpenseSerializer
    filterset_class = TeamExpenseFilter
    search_fields = ('note',)
    ordering_fields = ('spent_at', 'amount')

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Expense.objects.none()
        _require_senior(self.request.user)
        return Expense.objects.filter(user_id__in=team_user_ids(self.request.user)).select_related('category', 'user')


class TeamSummaryView(APIView):
    @extend_schema(tags=['team'], responses=TeamSummarySerializer,
                   parameters=PERIOD_PARAMS + [OpenApiParameter('member', int, description='Only this user')])
    def get(self, request):
        """Team totals for a period: overall, per user, per category and per day."""
        _require_senior(request.user)
        start, end, tz = _period(request)
        ids = team_user_ids(request.user)
        member = request.query_params.get('member')
        if member:
            if not member.isdigit() or int(member) not in ids:
                raise ValidationError({'member': 'Not a member of your team.'})
            ids = [int(member)]
        data, qs = _summary(Expense.objects.filter(user_id__in=ids), categories_for(request.user), start, end, tz)
        people = {u.id: u for u in User.objects.filter(id__in=ids)}
        data['by_member'] = [
            {'member': people[r['user']], 'total': r['total'], 'count': r['count']}
            for r in qs.values('user').annotate(total=Sum('amount'), count=Count('id')).order_by('-total')
        ]
        return Response(TeamSummarySerializer(data).data)
