class Person {
  Person({required this.id, required this.name, required this.email});

  final int id;
  final String name;
  final String email;

  factory Person.fromJson(Map<String, dynamic> j) => Person(id: j['id'], name: j['name'] ?? '', email: j['email'] ?? '');
}

class AppUser {
  AppUser({
    required this.id,
    required this.email,
    required this.firstName,
    required this.currency,
    this.monthlyBudget,
    this.role = 'user',
    this.senior,
    this.inviteCode,
    this.canManageCategories = true,
    this.balanceTracking = false,
    this.openingBalance = 0,
    this.balanceStart,
  });

  final int id;
  final String email;
  final String firstName;
  final String currency;
  final double? monthlyBudget;

  /// 'senior' or 'user'
  final String role;

  /// The senior this user joined, if any.
  final Person? senior;

  /// Seniors only.
  final String? inviteCode;

  /// False for users in a senior's team — the senior owns the category list.
  final bool canManageCategories;

  /// Off: expenses only. On: Home also shows balance remaining (opening + credits − expenses).
  final bool balanceTracking;
  final double openingBalance;

  /// When balance counting started.
  final DateTime? balanceStart;

  bool get isSenior => role == 'senior';

  factory AppUser.fromJson(Map<String, dynamic> j) => AppUser(
    id: j['id'],
    email: j['email'],
    firstName: j['first_name'] ?? '',
    currency: j['currency'] ?? 'INR',
    monthlyBudget: j['monthly_budget'] == null ? null : double.parse(j['monthly_budget'].toString()),
    role: j['role'] ?? 'user',
    senior: j['senior'] == null ? null : Person.fromJson(j['senior']),
    inviteCode: j['invite_code'],
    canManageCategories: j['can_manage_categories'] ?? true,
    balanceTracking: j['balance_tracking'] ?? false,
    openingBalance: double.tryParse('${j['opening_balance']}') ?? 0,
    balanceStart: j['balance_start'] == null ? null : DateTime.parse(j['balance_start']).toLocal(),
  );
}

class Category {
  Category({required this.id, required this.name, required this.icon, required this.color, this.keywords = ''});

  final int id;
  final String name;
  final String icon;
  final String color;

  /// Comma-separated words that make quick add pick this category. Not sent in brief/nested payloads.
  final String keywords;

  factory Category.fromJson(Map<String, dynamic> j) =>
      Category(id: j['id'], name: j['name'], icon: j['icon'] ?? '🏷️', color: j['color'] ?? '#6366f1', keywords: j['keywords'] ?? '');
}

class Expense {
  Expense({
    required this.id,
    required this.amount,
    required this.note,
    required this.category,
    required this.spentAt,
    this.pending = false,
    this.member,
  });

  final int? id;
  final double amount;
  final String note;
  final Category? category;
  final DateTime spentAt;

  /// True while the expense sits in the offline queue and hasn't reached the server yet.
  final bool pending;

  /// Who spent it (team view for seniors only).
  final Person? member;

  factory Expense.fromJson(Map<String, dynamic> j) => Expense(
    id: j['id'],
    amount: double.parse(j['amount'].toString()),
    note: j['note'] ?? '',
    category: j['category_detail'] == null ? null : Category.fromJson(j['category_detail']),
    spentAt: DateTime.parse(j['spent_at']).toLocal(),
    member: j['member'] == null ? null : Person.fromJson(j['member']),
  );
}

class Frequent {
  Frequent({required this.amount, required this.note, required this.category});

  final double amount;
  final String note;
  final Category? category;

  factory Frequent.fromJson(Map<String, dynamic> j) => Frequent(
    amount: double.parse(j['amount'].toString()),
    note: j['note'] ?? '',
    category: j['category'] == null ? null : Category.fromJson(j['category']),
  );
}

class CategoryTotal {
  CategoryTotal(this.category, this.total);
  final Category? category;
  final double total;
}

class Summary {
  Summary({
    required this.total,
    required this.count,
    required this.previousTotal,
    required this.uncategorizedCount,
    required this.byCategory,
    this.creditTotal = 0,
  });

  final double total;
  final int count;
  final double previousTotal;
  final int uncategorizedCount;
  final List<CategoryTotal> byCategory;

  /// Credits received in the period.
  final double creditTotal;

  factory Summary.fromJson(Map<String, dynamic> j) => Summary(
    total: double.parse(j['total'].toString()),
    count: j['count'],
    previousTotal: double.parse(j['previous_total'].toString()),
    uncategorizedCount: j['uncategorized_count'],
    byCategory: (j['by_category'] as List)
        .map((r) => CategoryTotal(r['category'] == null ? null : Category.fromJson(r['category']), double.parse(r['total'].toString())))
        .toList(),
    creditTotal: double.tryParse('${j['credit_total']}') ?? 0,
  );
}

class TeamMember {
  TeamMember({
    required this.person,
    required this.monthTotal,
    required this.monthCount,
    required this.uncategorizedCount,
    required this.lastSpentAt,
    required this.isSenior,
  });

  final Person person;
  final double monthTotal;
  final int monthCount;
  final int uncategorizedCount;
  final DateTime? lastSpentAt;
  final bool isSenior;

  factory TeamMember.fromJson(Map<String, dynamic> j) => TeamMember(
    person: Person.fromJson(j),
    monthTotal: double.parse(j['month_total'].toString()),
    monthCount: j['month_count'],
    uncategorizedCount: j['uncategorized_count'],
    lastSpentAt: j['last_spent_at'] == null ? null : DateTime.parse(j['last_spent_at']).toLocal(),
    isSenior: j['is_senior'] ?? false,
  );
}

/// Money received (salary, refund, gift…). Private to its owner.
class Credit {
  Credit({
    required this.id,
    required this.amount,
    required this.note,
    required this.source,
    required this.receivedAt,
    this.pending = false,
  });

  final int? id;
  final double amount;
  final String note;
  final String source;
  final DateTime receivedAt;

  /// True while waiting in the offline queue.
  final bool pending;

  factory Credit.fromJson(Map<String, dynamic> j) => Credit(
    id: j['id'],
    amount: double.parse(j['amount'].toString()),
    note: j['note'] ?? '',
    source: j['source'] ?? 'other',
    receivedAt: DateTime.parse(j['received_at']).toLocal(),
  );
}

class BalanceInfo {
  BalanceInfo({required this.since, required this.opening, required this.credits, required this.expenses, required this.balance});

  final DateTime? since;
  final double opening;
  final double credits;
  final double expenses;
  final double balance;

  factory BalanceInfo.fromJson(Map<String, dynamic> j) => BalanceInfo(
    since: j['since'] == null ? null : DateTime.parse(j['since']).toLocal(),
    opening: double.parse(j['opening_balance'].toString()),
    credits: double.parse(j['credits'].toString()),
    expenses: double.parse(j['expenses'].toString()),
    balance: double.parse(j['balance'].toString()),
  );
}
