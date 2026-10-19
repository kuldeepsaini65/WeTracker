import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models.dart';
import '../store.dart';
import 'common.dart';
import 'quick_add_sheet.dart';

/// Credit sources — keep in sync with Credit.SOURCE_CHOICES on the server and web/src/lib/credits.ts.
const creditSources = <(String, String, String)>[
  ('salary', 'Salary', '💼'),
  ('business', 'Business', '🏪'),
  ('freelance', 'Freelance', '💻'),
  ('gift', 'Gift', '🎁'),
  ('refund', 'Refund', '↩️'),
  ('interest', 'Interest', '🏦'),
  ('other', 'Other', '💰'),
];

(String, String, String) creditSource(String value) => creditSources.firstWhere((s) => s.$1 == value, orElse: () => creditSources.last);

const creditGreen = Color(0xFF059669);

/// The "Credits" half of the Expenses tab.
class CreditsView extends StatefulWidget {
  const CreditsView({super.key, required this.header});

  /// The Expenses | Credits switch, shown at the top of the list.
  final Widget header;

  @override
  State<CreditsView> createState() => _CreditsViewState();
}

class _CreditsViewState extends State<CreditsView> {
  final store = AppStore.instance;
  List<Credit>? _items;
  String? _error;

  @override
  void initState() {
    super.initState();
    store.addListener(_load);
    _load();
  }

  @override
  void dispose() {
    store.removeListener(_load);
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final items = await store.api.credits();
      if (mounted) {
        setState(() {
          _items = items;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final items = [...store.pendingCredits.reversed, ...?_items];
    final now = DateTime.now();
    final monthTotal = items
        .where((c) => c.receivedAt.year == now.year && c.receivedAt.month == now.month)
        .fold<double>(0, (s, c) => s + c.amount);

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 120),
        children: [
          widget.header,
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Received this month', style: TextStyle(color: scheme.outline, fontSize: 13)),
                      Text(
                        '+${money(monthTotal, store.currency)}',
                        style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: creditGreen),
                      ),
                    ],
                  ),
                ),
                FilledButton.icon(
                  style: FilledButton.styleFrom(backgroundColor: creditGreen, foregroundColor: Colors.white),
                  onPressed: () => showQuickAdd(context, credit: true),
                  icon: const Icon(Icons.add),
                  label: const Text('Add credit'),
                ),
              ],
            ),
          ),
          if (store.user?.balanceTracking != true)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
              child: Text(
                'Tip: turn on Balance tracking in Settings to see how much money you have left.',
                style: TextStyle(color: scheme.outline, fontSize: 12),
              ),
            ),
          if (_items == null && _error == null)
            const Padding(
              padding: EdgeInsets.all(32),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_error != null && _items == null)
            ListTile(
              leading: const Icon(Icons.wifi_off_rounded),
              title: const Text('Couldn\'t load your credits'),
              subtitle: Text(_error!, maxLines: 2, overflow: TextOverflow.ellipsis),
              trailing: TextButton(onPressed: _load, child: const Text('Retry')),
            )
          else if (items.isEmpty)
            Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                children: [
                  const Text('💰', style: TextStyle(fontSize: 40)),
                  const SizedBox(height: 8),
                  const Text('No credits yet', style: TextStyle(fontWeight: FontWeight.w600)),
                  Text('Add your salary or any money you receive.', style: TextStyle(color: scheme.outline)),
                ],
              ),
            )
          else
            ..._grouped(context, items),
        ],
      ),
    );
  }

  List<Widget> _grouped(BuildContext context, List<Credit> items) {
    final out = <Widget>[];
    String? last;
    for (final c in items) {
      final label = dayLabel(c.receivedAt);
      if (label != last) {
        last = label;
        out.add(
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
            child: Text(
              label.toUpperCase(),
              style: Theme.of(context).textTheme.labelSmall?.copyWith(letterSpacing: 1, color: Theme.of(context).colorScheme.outline),
            ),
          ),
        );
      }
      out.add(CreditTile(credit: c, currency: store.currency, onTap: () => showEditCredit(context, c)));
    }
    return out;
  }
}

class CreditTile extends StatelessWidget {
  const CreditTile({super.key, required this.credit, required this.currency, this.onTap});
  final Credit credit;
  final String currency;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final src = creditSource(credit.source);
    final scheme = Theme.of(context).colorScheme;
    return ListTile(
      onTap: onTap,
      leading: Container(
        width: 42,
        height: 42,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: creditGreen.withValues(alpha: .14), borderRadius: BorderRadius.circular(13)),
        child: Text(src.$3, style: const TextStyle(fontSize: 19)),
      ),
      title: Text(
        credit.note.isEmpty ? src.$2 : credit.note,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(fontWeight: FontWeight.w600),
      ),
      subtitle: Row(
        children: [
          if (credit.pending) ...[Icon(Icons.cloud_upload_outlined, size: 14, color: scheme.outline), const SizedBox(width: 4)],
          Flexible(child: Text('${src.$2} · ${DateFormat.jm().format(credit.receivedAt)}', maxLines: 1, overflow: TextOverflow.ellipsis)),
        ],
      ),
      trailing: Text(
        '+${money(credit.amount, currency)}',
        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: creditGreen, fontFeatures: [FontFeature.tabularFigures()]),
      ),
    );
  }
}

Future<void> showEditCredit(BuildContext context, Credit c) {
  if (c.id == null) {
    showSnack(context, 'Still syncing — you can edit it once it\'s uploaded.');
    return Future.value();
  }
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => _EditCredit(credit: c),
  );
}

class _EditCredit extends StatefulWidget {
  const _EditCredit({required this.credit});
  final Credit credit;

  @override
  State<_EditCredit> createState() => _EditCreditState();
}

class _EditCreditState extends State<_EditCredit> {
  final store = AppStore.instance;
  late final _amount = TextEditingController(
    text: widget.credit.amount == widget.credit.amount.roundToDouble()
        ? widget.credit.amount.toStringAsFixed(0)
        : widget.credit.amount.toStringAsFixed(2),
  );
  late final _note = TextEditingController(text: widget.credit.note);
  late String _source = widget.credit.source;
  late DateTime _when = widget.credit.receivedAt;
  bool _busy = false;

  @override
  void dispose() {
    _amount.dispose();
    _note.dispose();
    super.dispose();
  }

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
    final id = widget.credit.id!;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Edit credit', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            TextField(
              controller: _amount,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              style: Theme.of(context).textTheme.headlineSmall,
              decoration: InputDecoration(labelText: 'Amount received (${store.currency})'),
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
                for (final s in creditSources)
                  ChoiceChip(
                    avatar: Text(s.$3),
                    label: Text(s.$2),
                    selected: _source == s.$1,
                    selectedColor: creditGreen.withValues(alpha: .22),
                    onSelected: (_) => setState(() => _source = s.$1),
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
                  onPressed: _busy ? null : () => _run(() => store.api.deleteCredit(id), 'Credit deleted'),
                  icon: const Icon(Icons.delete_outline),
                  label: const Text('Delete'),
                  style: TextButton.styleFrom(foregroundColor: Theme.of(context).colorScheme.error),
                ),
                const Spacer(),
                FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: creditGreen, foregroundColor: Colors.white),
                  onPressed: _busy
                      ? null
                      : () {
                          final a = double.tryParse(_amount.text.replaceAll(',', '.'));
                          if (a == null || a <= 0) return showSnack(context, 'Enter a valid amount');
                          _run(
                            () => store.api.updateCredit(id, {
                              'amount': a.toStringAsFixed(2),
                              'note': _note.text.trim(),
                              'source': _source,
                              'received_at': _when.toUtc().toIso8601String(),
                            }),
                            'Credit updated',
                          );
                        },
                  child: const Text('Save'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
