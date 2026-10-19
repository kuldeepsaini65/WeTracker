import 'package:flutter_test/flutter_test.dart';
import 'package:wetracker/models.dart';
import 'package:wetracker/store.dart';
import 'package:wetracker/ui/common.dart';

void main() {
  test('parses expense JSON from the API', () {
    final e = Expense.fromJson({
      'id': 1,
      'amount': '250.00',
      'note': 'coffee',
      'category_detail': {'id': 2, 'name': 'Coffee & Tea', 'icon': '☕', 'color': '#a16207'},
      'spent_at': '2026-10-12T10:00:00Z',
    });
    expect(e.amount, 250);
    expect(e.category!.name, 'Coffee & Tea');
  });

  test('pending expense round-trips and omits a missing category', () {
    final p = PendingExpense(clientId: newClientId(), amount: 99.5, note: 'chai', spentAt: DateTime(2026, 10, 12));
    final j = p.toJson();
    expect(j.containsKey('category'), isFalse);
    expect(PendingExpense.fromJson(j).amount, 99.5);
  });

  test('money trims .00', () {
    expect(money(250, 'INR'), '₹250');
    expect(hexColor('#ff0000').toARGB32(), 0xFFFF0000);
  });

  test('offline queue: old items stay expenses, credits post the credit fields', () {
    // Saved by an older app version (no "kind")
    final legacy = PendingExpense.fromJson({'client_id': 'a', 'amount': '50.00', 'note': 'chai', 'spent_at': '2026-10-12T10:00:00Z'});
    expect(legacy.isCredit, isFalse);
    expect(legacy.payload().containsKey('spent_at'), isTrue);
    expect(legacy.payload().containsKey('kind'), isFalse);

    final credit = PendingExpense(clientId: 'b', amount: 50000, note: 'salary', spentAt: DateTime(2026, 10, 1), kind: 'credit', source: 'salary');
    final restored = PendingExpense.fromJson(credit.toJson());
    expect(restored.isCredit, isTrue);
    expect(restored.payload()['source'], 'salary');
    expect(restored.payload().containsKey('received_at'), isTrue);
    expect(restored.payload().containsKey('spent_at'), isFalse);
  });

  test('user and summary parse balance fields, with safe defaults', () {
    final old = AppUser.fromJson({'id': 1, 'email': 'a@b.c'});
    expect(old.balanceTracking, isFalse);
    expect(old.openingBalance, 0);
    final on = AppUser.fromJson({'id': 1, 'email': 'a@b.c', 'balance_tracking': true, 'opening_balance': '5000.00', 'balance_start': '2026-10-18T00:00:00Z'});
    expect(on.balanceTracking, isTrue);
    expect(on.openingBalance, 5000);
    expect(on.balanceStart, isNotNull);
    final b = BalanceInfo.fromJson({'since': null, 'opening_balance': '5000.00', 'credits': '20000.00', 'expenses': '1200.00', 'balance': '23800.00'});
    expect(b.balance, 23800);
  });
}
