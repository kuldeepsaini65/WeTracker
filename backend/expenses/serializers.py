from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .defaults import setup_new_user
from .models import Category, Expense, Profile
from .teams import categories_for, category_owner, join_senior, make_senior, profile_of

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    email = serializers.EmailField()
    currency = serializers.CharField(write_only=True, required=False, max_length=8)
    account_type = serializers.ChoiceField(
        choices=(('personal', 'Personal'), ('senior', 'Senior')), default='personal', write_only=True,
        help_text='"senior" creates a team with an invite code. Ignored when invite_code is given.')
    invite_code = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=12,
                                        help_text="A senior's invite code to join their team.")

    class Meta:
        model = User
        fields = ('id', 'email', 'first_name', 'password', 'currency', 'account_type', 'invite_code')

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate_invite_code(self, value):
        value = value.strip().upper()
        if value and not Profile.objects.filter(invite_code=value, role=Profile.ROLE_SENIOR).exists():
            raise serializers.ValidationError('That invite code is not valid.')
        return value

    def create(self, validated_data):
        currency = validated_data.pop('currency', None)
        invite_code = validated_data.pop('invite_code', '')
        account_type = validated_data.pop('account_type', 'personal')
        user = User.objects.create_user(
            username=validated_data['email'],
            email=validated_data['email'],
            first_name=validated_data.get('first_name', ''),
            password=validated_data['password'],
        )
        setup_new_user(user)
        if currency:
            user.profile.currency = currency.upper()
            user.profile.save()
        if invite_code:
            join_senior(user, invite_code)
        elif account_type == 'senior':
            make_senior(user)
        return user


class PersonBriefSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'name', 'email')

    def get_name(self, obj) -> str:
        return obj.first_name or obj.email.split('@')[0]


class MeSerializer(serializers.ModelSerializer):
    currency = serializers.CharField(source='profile.currency', max_length=8)
    monthly_budget = serializers.DecimalField(
        source='profile.monthly_budget', max_digits=12, decimal_places=2, allow_null=True, required=False)
    role = serializers.CharField(source='profile.role', read_only=True)
    senior = PersonBriefSerializer(source='profile.senior', read_only=True, allow_null=True)
    invite_code = serializers.CharField(source='profile.invite_code', read_only=True, allow_null=True)
    can_manage_categories = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'email', 'first_name', 'currency', 'monthly_budget', 'role', 'senior', 'invite_code',
                  'can_manage_categories')
        read_only_fields = ('id', 'email')

    def to_representation(self, instance):
        profile_of(instance)  # make sure a profile exists (e.g. for createsuperuser accounts)
        return super().to_representation(instance)

    def get_can_manage_categories(self, obj) -> bool:
        return category_owner(obj) == obj

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', {})
        instance = super().update(instance, validated_data)
        profile = profile_of(instance)
        for key, value in profile_data.items():
            setattr(profile, key, value.upper() if key == 'currency' else value)
        profile.save()
        return instance


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ('id', 'name', 'icon', 'color', 'keywords', 'position')

    def validate_name(self, value):
        user = self.context['request'].user
        qs = categories_for(user).filter(name__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('You already have a category with this name.')
        return value


class CategoryBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ('id', 'name', 'icon', 'color')


@extend_schema_field(OpenApiTypes.INT)
class UserCategoryField(serializers.PrimaryKeyRelatedField):
    def get_queryset(self):
        return categories_for(self.context['request'].user)


class ExpenseSerializer(serializers.ModelSerializer):
    category = UserCategoryField(allow_null=True, required=False)
    category_detail = CategoryBriefSerializer(source='category', read_only=True)

    class Meta:
        model = Expense
        fields = ('id', 'amount', 'note', 'category', 'category_detail', 'spent_at', 'client_id',
                  'created_at', 'updated_at')
        read_only_fields = ('created_at', 'updated_at')

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Amount must be greater than zero.')
        return value


class QuickAddSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=300, help_text='e.g. "250 coffee", "uber 180 #transport", "1.2k rent yesterday"')
    client_id = serializers.CharField(max_length=64, required=False, allow_blank=True)


class QuickParseResponseSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    note = serializers.CharField()
    category = CategoryBriefSerializer(allow_null=True)
    days_ago = serializers.IntegerField()


class BulkCategorizeSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.IntegerField(), min_length=1, max_length=500)
    category = UserCategoryField(allow_null=True)


class FrequentExpenseSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    note = serializers.CharField()
    category = CategoryBriefSerializer(allow_null=True)
    count = serializers.IntegerField()


class CategoryTotalSerializer(serializers.Serializer):
    category = CategoryBriefSerializer(allow_null=True)
    total = serializers.DecimalField(max_digits=14, decimal_places=2)
    count = serializers.IntegerField()


class DailyTotalSerializer(serializers.Serializer):
    date = serializers.DateField()
    total = serializers.DecimalField(max_digits=14, decimal_places=2)


class SummarySerializer(serializers.Serializer):
    start = serializers.DateTimeField()
    end = serializers.DateTimeField()
    total = serializers.DecimalField(max_digits=14, decimal_places=2)
    count = serializers.IntegerField()
    uncategorized_count = serializers.IntegerField()
    previous_total = serializers.DecimalField(max_digits=14, decimal_places=2)
    by_category = CategoryTotalSerializer(many=True)
    daily = DailyTotalSerializer(many=True)


class TeamExpenseSerializer(ExpenseSerializer):
    member = PersonBriefSerializer(source='user', read_only=True)

    class Meta(ExpenseSerializer.Meta):
        fields = ExpenseSerializer.Meta.fields + ('member',)
        read_only_fields = fields


class JoinTeamSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=12)


class TeamMemberSerializer(PersonBriefSerializer):
    joined_at = serializers.DateTimeField(source='profile.joined_at', allow_null=True)
    month_total = serializers.DecimalField(max_digits=14, decimal_places=2)
    month_count = serializers.IntegerField()
    uncategorized_count = serializers.IntegerField()
    last_spent_at = serializers.DateTimeField(allow_null=True)
    is_senior = serializers.BooleanField()

    class Meta(PersonBriefSerializer.Meta):
        fields = PersonBriefSerializer.Meta.fields + (
            'joined_at', 'month_total', 'month_count', 'uncategorized_count', 'last_spent_at', 'is_senior')


class TeamSerializer(serializers.Serializer):
    role = serializers.CharField()
    invite_code = serializers.CharField(allow_null=True)
    senior = PersonBriefSerializer(allow_null=True)
    members = TeamMemberSerializer(many=True)


class MemberTotalSerializer(serializers.Serializer):
    member = PersonBriefSerializer()
    total = serializers.DecimalField(max_digits=14, decimal_places=2)
    count = serializers.IntegerField()


class TeamSummarySerializer(SummarySerializer):
    by_member = MemberTotalSerializer(many=True)
