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
}
