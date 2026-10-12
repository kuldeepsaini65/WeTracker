import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models.dart';

Color hexColor(String hex) {
  final h = hex.replaceFirst('#', '');
  return Color(int.parse(h.length == 6 ? 'FF$h' : h, radix: 16));
}

final _fmt = <String, NumberFormat>{};
String money(num v, String currency) {
  final f = _fmt.putIfAbsent(currency, () {
    try {
      return NumberFormat.simpleCurrency(name: currency, decimalDigits: 2);
    } catch (_) {
      return NumberFormat.decimalPattern();
    }
  });
  final s = f.format(v);
  return s.endsWith('.00') ? s.substring(0, s.length - 3) : s;
}

String dayLabel(DateTime d) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final diff = today.difference(DateTime(d.year, d.month, d.day)).inDays;
  if (diff == 0) return 'Today';
  if (diff == 1) return 'Yesterday';
  if (diff < 7) return DateFormat.EEEE().format(d);
  return d.year == now.year ? DateFormat.MMMd().format(d) : DateFormat.yMMMd().format(d);
}

class CategoryAvatar extends StatelessWidget {
  const CategoryAvatar(this.category, {super.key, this.size = 42});
  final Category? category;
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = category;
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: c == null ? null : hexColor(c.color).withValues(alpha: .15),
        borderRadius: BorderRadius.circular(size * .3),
        border: c == null ? Border.all(color: Theme.of(context).colorScheme.outlineVariant) : null,
      ),
      child: Text(
        c?.icon ?? '?',
        style: TextStyle(fontSize: size * .45, color: Theme.of(context).colorScheme.outline),
      ),
    );
  }
}

class ExpenseTile extends StatelessWidget {
  const ExpenseTile({super.key, required this.expense, required this.currency, this.onTap, this.selected, this.trailing});
  final Expense expense;
  final String currency;
  final VoidCallback? onTap;
  final bool? selected;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final e = expense;
    final scheme = Theme.of(context).colorScheme;
    return ListTile(
      onTap: onTap,
      selected: selected ?? false,
      selectedTileColor: scheme.primaryContainer.withValues(alpha: .4),
      leading: selected != null ? Checkbox(value: selected, onChanged: (_) => onTap?.call()) : CategoryAvatar(e.category),
      title: Text(
        e.note.isEmpty ? 'No note' : e.note,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(fontWeight: FontWeight.w600, color: e.note.isEmpty ? scheme.outline : null),
      ),
      subtitle: Row(
        children: [
          if (e.pending) ...[Icon(Icons.cloud_upload_outlined, size: 14, color: scheme.outline), const SizedBox(width: 4)],
          Flexible(
            child: Text(
              '${e.member == null ? '' : '${e.member!.name} · '}${e.category?.name ?? 'Uncategorized'} · ${DateFormat.jm().format(e.spentAt)}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: e.category == null ? Colors.amber.shade700 : null),
            ),
          ),
        ],
      ),
      trailing:
          trailing ??
          Text(
            money(e.amount, currency),
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, fontFeatures: [FontFeature.tabularFigures()]),
          ),
    );
  }
}

/// Expenses grouped under day headers.
List<Widget> groupedExpenseTiles(BuildContext context, List<Expense> expenses, String currency, {void Function(Expense)? onTap}) {
  final out = <Widget>[];
  String? last;
  for (final e in expenses) {
    final label = dayLabel(e.spentAt);
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
    out.add(ExpenseTile(expense: e, currency: currency, onTap: onTap == null ? null : () => onTap(e)));
  }
  return out;
}

void showSnack(BuildContext context, String msg, {SnackBarAction? action}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(msg), action: action, behavior: SnackBarBehavior.floating));
}
