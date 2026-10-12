import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models.dart';
import '../store.dart';
import 'common.dart';

Future<void> showEditExpense(BuildContext context, Expense e) {
  if (e.id == null) {
    showSnack(context, 'Still syncing — you can edit it once it\'s uploaded.');
    return Future.value();
  }
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => _EditExpense(expense: e),
  );
}

class _EditExpense extends StatefulWidget {
  const _EditExpense({required this.expense});
  final Expense expense;

  @override
  State<_EditExpense> createState() => _EditExpenseState();
}

class _EditExpenseState extends State<_EditExpense> {
  final store = AppStore.instance;
  late final _amount = TextEditingController(text: _trim(widget.expense.amount));
  late final _note = TextEditingController(text: widget.expense.note);
  late int? _categoryId = widget.expense.category?.id;
  late DateTime _when = widget.expense.spentAt;
  bool _busy = false;

  static String _trim(double v) => v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toStringAsFixed(2);

  Future<void> _run(Future<void> Function() action, String done) async {
    setState(() => _busy = true);
    final nav = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await action();
      await store.refresh();
      nav.pop();
      messenger.showSnackBar(SnackBar(content: Text(done), behavior: SnackBarBehavior.floating));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.toString()), behavior: SnackBarBehavior.floating));
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pickDate() async {
    final d = await showDatePicker(
      context: context,
      initialDate: _when,
      firstDate: DateTime(2000),
      lastDate: DateTime.now().add(const Duration(days: 1)),
    );
    if (d == null || !mounted) return;
    final t = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(_when));
    setState(() => _when = DateTime(d.year, d.month, d.day, t?.hour ?? _when.hour, t?.minute ?? _when.minute));
  }

  @override
  Widget build(BuildContext context) {
    final id = widget.expense.id!;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + MediaQuery.of(context).viewInsets.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Edit expense', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 16),
          TextField(
            controller: _amount,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            style: Theme.of(context).textTheme.headlineSmall,
            decoration: InputDecoration(labelText: 'Amount (${store.currency})'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _note,
            decoration: const InputDecoration(labelText: 'Note'),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              ChoiceChip(
                label: const Text('Uncategorized'),
                selected: _categoryId == null,
                onSelected: (_) => setState(() => _categoryId = null),
              ),
              for (final c in store.categories)
                ChoiceChip(
                  avatar: Text(c.icon),
                  label: Text(c.name),
                  selected: _categoryId == c.id,
                  selectedColor: hexColor(c.color).withValues(alpha: .25),
                  onSelected: (_) => setState(() => _categoryId = c.id),
                ),
            ],
          ),
          const SizedBox(height: 12),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.event),
            title: Text(DateFormat.yMMMEd().add_jm().format(_when)),
            onTap: _pickDate,
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              TextButton.icon(
                onPressed: _busy ? null : () => _run(() => store.api.deleteExpense(id), 'Expense deleted'),
                icon: const Icon(Icons.delete_outline),
                label: const Text('Delete'),
                style: TextButton.styleFrom(foregroundColor: Theme.of(context).colorScheme.error),
              ),
              const Spacer(),
              FilledButton(
                onPressed: _busy
                    ? null
                    : () {
                        final a = double.tryParse(_amount.text.replaceAll(',', '.'));
                        if (a == null || a <= 0) return showSnack(context, 'Enter a valid amount');
                        _run(
                          () => store.api.updateExpense(id, {
                            'amount': a.toStringAsFixed(2),
                            'note': _note.text.trim(),
                            'category': _categoryId,
                            'spent_at': _when.toUtc().toIso8601String(),
                          }),
                          'Expense updated',
                        );
                      },
                child: const Text('Save'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
