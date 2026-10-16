from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .defaults import DEFAULT_CATEGORIES, setup_new_user
from .models import Expense
from .quick import parse_quick

User = get_user_model()


class DefaultsTests(APITestCase):
    def test_default_categories_shape(self):
        for row in DEFAULT_CATEGORIES:
            self.assertEqual(len(row), 4, f'{row[0]}: use (name, icon, colour, "kw1,kw2,...")')

    def test_keywords_are_unique_across_categories(self):
        # The first matching category wins, so a shared keyword would always go to the earlier one.
        seen = {}
        for name, _, _, keywords in DEFAULT_CATEGORIES:
            for kw in (k.strip().lower() for k in keywords.split(',') if k.strip()):
                self.assertNotIn(kw, seen, f'"{kw}" is in both {seen.get(kw)} and {name}')
                seen[kw] = name

    def test_hinglish_notes(self):
        user = User.objects.create_user('h@b.com', 'h@b.com', 'pw-123456!')
        setup_new_user(user)
        cases = {
            '120 sabzi': 'Groceries', '40 cutting chai': 'Coffee & Tea', '30 vada pav': 'Food',
            '60 auto': 'Transport', '1500 bijli bill': 'Bills', '850 gas cylinder': 'Bills',
            '200 dawai': 'Health', '500 daaru party': 'Party', '20 sutta': 'Cigarettes',
            '300 movie ticket': 'Entertainment', '2k petrol': 'Fuel', '700 kapde': 'Shopping',
        }
        for text, expected in cases.items():
            p = parse_quick(user, text)
            self.assertEqual(p.category and p.category.name, expected, text)


class QuickParseTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('a@b.com', 'a@b.com', 'pw-123456!')
        setup_new_user(self.user)

    def test_amount_first_and_keyword_category(self):
        p = parse_quick(self.user, '250 coffee')
        self.assertEqual(p.amount, Decimal('250'))
        self.assertEqual(p.note, 'coffee')
        self.assertEqual(p.category.name, 'Coffee & Tea')

    def test_amount_last_tag_and_day(self):
        p = parse_quick(self.user, 'cab home 180 #transport yesterday')
        self.assertEqual(p.amount, Decimal('180'))
        self.assertEqual(p.note, 'cab home')
        self.assertEqual(p.category.name, 'Transport')
        self.assertEqual(p.days_ago, 1)

    def test_k_suffix_currency_and_decimals(self):
        self.assertEqual(parse_quick(self.user, '1.5k rent').amount, Decimal('1500'))
        self.assertEqual(parse_quick(self.user, '₹99.50 netflix').amount, Decimal('99.50'))
        self.assertEqual(parse_quick(self.user, 'rs120 chai').amount, Decimal('120'))

    def test_unknown_note_is_uncategorized(self):
        self.assertIsNone(parse_quick(self.user, '500 xyz thing').category)

    def test_learns_from_history(self):
        other = self.user.categories.get(name='Shopping')
        Expense.objects.create(user=self.user, amount=10, note='xyz thing', category=other)
        self.assertEqual(parse_quick(self.user, '500 xyz thing').category, other)


class ApiTests(APITestCase):
    def setUp(self):
        r = self.client.post('/api/auth/register/', {'email': 'Me@X.com', 'password': 'super-secret-1', 'first_name': 'K'})
        self.assertEqual(r.status_code, 201, r.data)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + r.data['access'])

    def test_login(self):
        self.client.credentials()
        r = self.client.post('/api/auth/login/', {'email': 'me@x.com', 'password': 'super-secret-1'})
        self.assertEqual(r.status_code, 200, r.data)
        self.assertIn('access', r.data)
        r = self.client.post('/api/auth/login/', {'email': 'me@x.com', 'password': 'nope'})
        self.assertEqual(r.status_code, 401)

    def test_default_categories(self):
        r = self.client.get('/api/categories/')
        self.assertEqual(len(r.data), len(DEFAULT_CATEGORIES))

    def test_quick_add_and_idempotency(self):
        r = self.client.post('/api/expenses/quick/', {'text': '250 lunch', 'client_id': 'abc'})
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['category_detail']['name'], 'Food')
        r2 = self.client.post('/api/expenses/quick/', {'text': '250 lunch', 'client_id': 'abc'})
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(Expense.objects.count(), 1)

    def test_quick_add_requires_amount(self):
        r = self.client.post('/api/expenses/quick/', {'text': 'coffee'})
        self.assertEqual(r.status_code, 400)

    def test_create_auto_suggests_and_uncategorized_flow(self):
        r = self.client.post('/api/expenses/', {'amount': '40', 'note': 'random'})
        self.assertEqual(r.status_code, 201, r.data)
        self.assertIsNone(r.data['category'])
        r = self.client.get('/api/expenses/?uncategorized=true')
        self.assertEqual(r.data['count'], 1)
        food = self.client.get('/api/categories/').data[0]['id']
        r = self.client.post('/api/expenses/bulk-categorize/', {'ids': [r.data['results'][0]['id']], 'category': food}, format='json')
        self.assertEqual(r.data['updated'], 1)
        self.assertEqual(self.client.get('/api/expenses/?uncategorized=true').data['count'], 0)

    def test_cannot_use_other_users_category(self):
        other = User.objects.create_user('o@x.com', 'o@x.com', 'pw-123456!')
        setup_new_user(other)
        cat = other.categories.first()
        r = self.client.post('/api/expenses/', {'amount': '40', 'category': cat.id})
        self.assertEqual(r.status_code, 400)

    def test_summary_and_frequent(self):
        for t in ('100 coffee', '100 coffee', '300 groceries', '50 mystery'):
            self.client.post('/api/expenses/quick/', {'text': t})
        r = self.client.get('/api/stats/summary/?tz=Asia/Kolkata')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(Decimal(r.data['total']), Decimal('550'))
        self.assertEqual(r.data['uncategorized_count'], 1)
        self.assertEqual(r.data['by_category'][0]['category']['name'], 'Groceries')
        r = self.client.get('/api/expenses/frequent/')
        self.assertEqual(r.data[0]['note'], 'coffee')
        self.assertEqual(r.data[0]['count'], 2)

    def test_schema(self):
        self.client.credentials()
        self.assertEqual(self.client.get('/api/schema/').status_code, 200)


class TeamTests(APITestCase):
    def register(self, email, **extra):
        r = self.client.post('/api/auth/register/', {'email': email, 'password': 'super-secret-1', **extra})
        self.assertEqual(r.status_code, 201, r.data)
        return r.data

    def auth(self, data):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + data['access'])

    def setUp(self):
        self.senior = self.register('boss@x.com', first_name='Boss', account_type='senior')
        self.code = self.senior['user']['invite_code']
        self.assertEqual(self.senior['user']['role'], 'senior')
        self.assertEqual(len(self.code), 8)

    def test_register_with_code_uses_senior_categories(self):
        u = self.register('u1@x.com', invite_code=self.code.lower())
        self.assertEqual(u['user']['senior']['email'], 'boss@x.com')
        self.assertFalse(u['user']['can_manage_categories'])
        self.auth(u)
        cats = self.client.get('/api/categories/').data
        boss = User.objects.get(email='boss@x.com')
        self.assertEqual({c['id'] for c in cats}, set(boss.categories.values_list('id', flat=True)))
        r = self.client.post('/api/expenses/quick/', {'text': '250 coffee'})
        self.assertEqual(r.data['category_detail']['name'], 'Coffee & Tea')
        # Users can't change the senior's categories
        self.assertEqual(self.client.post('/api/categories/', {'name': 'Mine'}).status_code, 403)
        self.assertEqual(self.client.delete(f"/api/categories/{cats[0]['id']}/").status_code, 403)

    def test_bad_code_rejected(self):
        r = self.client.post('/api/auth/register/', {'email': 'x@x.com', 'password': 'super-secret-1', 'invite_code': 'NOPE1234'})
        self.assertEqual(r.status_code, 400)

    def test_join_later_remaps_categories_and_leave_restores(self):
        u = self.register('u2@x.com')
        self.auth(u)
        self.client.post('/api/expenses/quick/', {'text': '100 uber'})
        mine = self.client.post('/api/categories/', {'name': 'Pets', 'icon': '🐶'}).data
        self.client.post('/api/expenses/', {'amount': '50', 'note': 'food for dog', 'category': mine['id']})
        r = self.client.post('/api/team/join/', {'code': self.code})
        self.assertEqual(r.status_code, 200, r.data)
        exps = {e['note']: e for e in self.client.get('/api/expenses/').data['results']}
        self.assertEqual(exps['uber']['category_detail']['name'], 'Transport')
        boss = User.objects.get(email='boss@x.com')
        self.assertTrue(boss.categories.filter(id=exps['uber']['category']).exists())
        self.assertIsNone(exps['food for dog']['category'])  # no "Pets" at the senior
        r = self.client.post('/api/team/leave/')
        self.assertIsNone(r.data['senior'])
        self.assertTrue(r.data['can_manage_categories'])
        exps = {e['note']: e for e in self.client.get('/api/expenses/').data['results']}
        self.assertEqual(exps['uber']['category_detail']['name'], 'Transport')
        self.assertFalse(boss.categories.filter(id=exps['uber']['category']).exists())

    def test_senior_sees_team_but_users_dont(self):
        u = self.register('u3@x.com', first_name='Asha', invite_code=self.code)
        other = self.register('outsider@x.com')
        self.auth(u)
        self.client.post('/api/expenses/quick/', {'text': '300 lunch'})
        self.assertEqual(self.client.get('/api/team/expenses/').status_code, 403)
        self.assertEqual(self.client.get('/api/team/summary/').status_code, 403)
        self.auth(other)
        self.client.post('/api/expenses/quick/', {'text': '999 secret'})

        self.auth(self.senior)
        self.client.post('/api/expenses/quick/', {'text': '100 coffee'})
        r = self.client.get('/api/team/')
        self.assertEqual({m['email'] for m in r.data['members']}, {'boss@x.com', 'u3@x.com'})
        asha = next(m for m in r.data['members'] if m['email'] == 'u3@x.com')
        self.assertEqual(Decimal(asha['month_total']), Decimal('300'))
        r = self.client.get('/api/team/expenses/')
        self.assertEqual(r.data['count'], 2)  # outsider excluded
        r = self.client.get(f"/api/team/expenses/?member={asha['id']}")
        self.assertEqual(r.data['results'][0]['member']['name'], 'Asha')
        r = self.client.get('/api/team/summary/?tz=Asia/Kolkata')
        self.assertEqual(Decimal(r.data['total']), Decimal('400'))
        self.assertEqual(r.data['by_member'][0]['member']['name'], 'Asha')
        # Read-only for the senior
        exp_id = self.client.get(f"/api/team/expenses/?member={asha['id']}").data['results'][0]['id']
        self.assertEqual(self.client.delete(f'/api/team/expenses/{exp_id}/').status_code, 405)
        self.assertEqual(self.client.delete(f'/api/expenses/{exp_id}/').status_code, 404)

    def test_remove_member_and_regenerate_code(self):
        u = self.register('u4@x.com', invite_code=self.code)
        self.auth(self.senior)
        new = self.client.post('/api/team/regenerate-code/').data['invite_code']
        self.assertNotEqual(new, self.code)
        self.assertEqual(self.client.delete(f"/api/team/members/{u['user']['id']}/").status_code, 204)
        self.assertEqual(len(self.client.get('/api/team/').data['members']), 1)
        self.auth(u)
        self.assertIsNone(self.client.get('/api/auth/me/').data['senior'])
        self.assertEqual(self.client.post('/api/team/join/', {'code': self.code}).status_code, 400)  # old code

    def test_senior_cannot_join_and_member_cannot_become_senior(self):
        self.auth(self.senior)
        self.assertEqual(self.client.post('/api/team/join/', {'code': self.code}).status_code, 400)
        u = self.register('u5@x.com', invite_code=self.code)
        self.auth(u)
        self.assertEqual(self.client.post('/api/team/become-senior/').status_code, 400)


class SyncDefaultsCommandTests(APITestCase):
    def test_sync_adds_missing_and_fixes_conflicts_without_touching_custom(self):
        from django.core.management import call_command
        from io import StringIO

        from .models import Category

        user = User.objects.create_user('old@b.com', 'old@b.com', 'pw-123456!')
        user.categories.all().delete()  # simulate an account made before these defaults existed
        Category.objects.create(user=user, name='Entertainment', keywords='movie,party,my-own')
        Category.objects.create(user=user, name='Fuel', keywords='petrol,gas')
        Category.objects.create(user=user, name='Cigret', keywords='sutta,advance')
        Category.objects.create(user=user, name='Pets', keywords='dog')
        call_command('sync_default_categories', stdout=StringIO())
        cats = {c.name: c for c in user.categories.all()}
        self.assertEqual(len(cats), len(DEFAULT_CATEGORIES) + 1)  # + Pets
        ent = cats['Entertainment'].keyword_list
        self.assertNotIn('party', ent)       # belongs to Party now
        self.assertIn('my-own', ent)         # user's own keyword kept
        self.assertIn('cinema', ent)         # new default added
        self.assertNotIn('gas', cats['Fuel'].keyword_list)
        self.assertNotIn('advance', cats['Cigarettes'].keyword_list)
        self.assertEqual(cats['Pets'].keywords, 'dog')
        self.assertEqual(parse_quick(user, '500 party').category.name, 'Party')
        # Running again changes nothing
        out = StringIO()
        call_command('sync_default_categories', stdout=out)
        self.assertIn('Made 0 changes', out.getvalue())


class RobustnessTests(APITestCase):
    def setUp(self):
        r = self.client.post('/api/auth/register/', {'email': 'tz@x.com', 'password': 'super-secret-1'})
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + r.data['access'])
        self.client.post('/api/expenses/quick/', {'text': '250 coffee'})

    def test_old_and_unknown_time_zones_never_break_stats(self):
        # Browsers in India report "Asia/Calcutta"; Ubuntu 24.04 servers don't ship that old name.
        from unittest import mock

        from . import views

        real = views.ZoneInfo

        def strict(name):
            if name == 'Asia/Calcutta':
                raise views.ZoneInfoNotFoundError(name)
            return real(name)

        with mock.patch.object(views, 'ZoneInfo', side_effect=strict):
            for tz in ('Asia/Calcutta', 'Mars/Olympus_Mons', ''):
                r = self.client.get(f'/api/stats/summary/?tz={tz}')
                self.assertEqual(r.status_code, 200, (tz, r.data))
                self.assertEqual(Decimal(r.data['total']), Decimal('250'))
            self.assertEqual(views._zone('Asia/Calcutta').key, 'Asia/Kolkata')

    def test_superuser_gets_categories_and_can_log_in_by_email(self):
        admin = User.objects.create_superuser('admin', 'Admin@Admin.com', 'super-secret-1')
        self.assertEqual(admin.categories.count(), len(DEFAULT_CATEGORIES))
        self.client.credentials()
        r = self.client.post('/api/auth/login/', {'email': 'admin@admin.com', 'password': 'super-secret-1'})
        self.assertEqual(r.status_code, 200, r.data)

    def test_team_month_follows_viewer_start(self):
        self.client.post('/api/team/become-senior/')
        far_future = '2099-01-01T00:00:00+05:30'
        m = self.client.get('/api/team/', {'start': far_future}).data['members'][0]
        self.assertEqual(Decimal(m['month_total']), Decimal('0'))
        m = self.client.get('/api/team/', {'tz': 'Asia/Calcutta'}).data['members'][0]
        self.assertEqual(Decimal(m['month_total']), Decimal('250'))


class DeleteAccountTests(APITestCase):
    def test_delete_requires_password_and_removes_everything(self):
        r = self.client.post('/api/auth/register/', {'email': 'gone@x.com', 'password': 'super-secret-1'})
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + r.data['access'])
        self.client.post('/api/expenses/quick/', {'text': '250 coffee'})
        self.assertEqual(self.client.post('/api/auth/delete-account/', {'password': 'nope'}).status_code, 400)
        self.assertTrue(User.objects.filter(email='gone@x.com').exists())
        self.assertEqual(self.client.post('/api/auth/delete-account/', {'password': 'super-secret-1'}).status_code, 204)
        self.assertFalse(User.objects.filter(email='gone@x.com').exists())
        self.assertEqual(Expense.objects.count(), 0)

    def test_deleting_senior_keeps_members_working(self):
        boss = self.client.post('/api/auth/register/', {'email': 'b@x.com', 'password': 'super-secret-1',
                                                        'account_type': 'senior'}).data
        u = self.client.post('/api/auth/register/', {'email': 'u@x.com', 'password': 'super-secret-1',
                                                     'invite_code': boss['user']['invite_code']}).data
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + u['access'])
        self.client.post('/api/expenses/quick/', {'text': '60 uber'})
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + boss['access'])
        self.assertEqual(self.client.post('/api/auth/delete-account/', {'password': 'super-secret-1'}).status_code, 204)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + u['access'])
        me = self.client.get('/api/auth/me/').data
        self.assertIsNone(me['senior'])
        self.assertTrue(me['can_manage_categories'])
        e = self.client.get('/api/expenses/').data['results'][0]
        self.assertEqual(e['category_detail']['name'], 'Transport')  # remapped to their own restored category
