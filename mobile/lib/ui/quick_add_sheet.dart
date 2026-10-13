import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models.dart';
import '../store.dart';
import 'categories_screen.dart';
import 'common.dart';

bool _sheetOpen = false;

Future<void> showQuickAdd(BuildContext context) async {
  if (_sheetOpen) return;
  _sheetOpen = true;
  try {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (_) => const QuickAddSheet(),
    );
  } finally {
    _sheetOpen = false;
  }
}

/// Amount-first entry: keypad is always on screen (no keyboard to summon), note and category
/// are optional. Save with just an amount and it lands in the Inbox as uncategorized.
class QuickAddSheet extends StatefulWidget {
  const QuickAddSheet({super.key});

  @override
  State<QuickAddSheet> createState() => _QuickAddSheetState();
}

class _QuickAddSheetState extends State<QuickAddSheet> {
  final store = AppStore.instance;
  final _note = TextEditingController();
  String _amount = '';
  Category? _picked; // chosen by the user
  Category? _suggested; // guessed from the note
  bool _yesterday = false;
  Timer? _debounce;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    // Categories / frequent items may still be loading when the sheet opens on launch.
    store.addListener(_changed);
  }

  void _changed() => setState(() {});

  @override
  void dispose() {
    store.removeListener(_changed);
    _debounce?.cancel();
    _note.dispose();
    super.dispose();
  }

  Category? get _category => _picked ?? _suggested;
  double get _value => double.tryParse(_amount) ?? 0;

  void _onNote(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () async {
      if (v.trim().isEmpty) return setState(() => _suggested = null);
      try {
        final s = await store.api.suggestCategory(v.trim());
        if (mounted && _note.text == v) setState(() => _suggested = s);
      } catch (_) {
        // offline: the server will auto-categorize on sync
      }
    });
  }

  void _key(String k) {
    HapticFeedback.selectionClick();
    setState(() {
      if (k == '⌫') {
        if (_amount.isNotEmpty) _amount = _amount.substring(0, _amount.length - 1);
      } else if (k == '.') {
        if (!_amount.contains('.')) _amount = _amount.isEmpty ? '0.' : '$_amount.';
      } else {
        final dot = _amount.indexOf('.');
        if (dot >= 0 && _amount.length - dot > 2) return; // max 2 decimals
        if (_amount.replaceAll('.', '').length >= 9) return;
        _amount = _amount == '0' ? k : _amount + k;
      }
    });
  }

  Future<void> _save({double? amount, String? note, Category? category}) async {
    final a = amount ?? _value;
    if (a <= 0 || _saving) return;
    setState(() => _saving = true);
    HapticFeedback.mediumImpact();
    final now = DateTime.now();
    final messenger = ScaffoldMessenger.of(context);
    final cat = category ?? _category;
    final n = note ?? _note.text.trim();
    Navigator.of(context).pop();
    final sent = await store.addExpense(
      amount: a,
      note: n,
      // With no category (e.g. offline, no suggestion yet) the server guesses one on sync.
      categoryId: cat?.id,
      spentAt: _yesterday ? now.subtract(const Duration(days: 1)) : now,
    );
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          content: Text(
            sent
                ? 'Added ${money(a, store.currency)}${n.isEmpty ? '' : ' · $n'} → ${cat == null ? 'Uncategorized' : '${cat.icon} ${cat.name}'}'
                : 'Saved offline · will sync when you\'re online',
          ),
        ),
      );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final hasAmount = _value > 0;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Frequent one-tap items
            if (store.frequent.isNotEmpty && _amount.isEmpty)
              SizedBox(
                height: 44,
                child: ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  scrollDirection: Axis.horizontal,
                  itemCount: store.frequent.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 8),
                  itemBuilder: (_, i) {
                    final f = store.frequent[i];
                    return ActionChip(
                      avatar: Text(f.category?.icon ?? '•'),
                      label: Text('${f.note} ${money(f.amount, store.currency)}'),
                      onPressed: () => _save(amount: f.amount, note: f.note, category: f.category),
                    );
                  },
                ),
              ),
            // Amount display
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 0),
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  money(_value, store.currency) + (_amount.endsWith('.') ? '.' : ''),
                  style: theme.textTheme.displayMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: hasAmount ? null : scheme.outlineVariant,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ),
            ),
            // Note
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
              child: TextField(
                controller: _note,
                onChanged: _onNote,
                textCapitalization: TextCapitalization.sentences,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _save(),
                decoration: InputDecoration(
                  hintText: 'Note (optional) — e.g. coffee',
                  prefixIcon: const Icon(Icons.edit_note),
                  filled: true,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
                  isDense: true,
                ),
              ),
            ),
            // Categories
            SizedBox(
              height: 44,
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                scrollDirection: Axis.horizontal,
                // Yesterday · categories · "+ New" (when this user may create categories)
                itemCount: store.categories.length + 1 + ((store.user?.canManageCategories ?? true) ? 1 : 0),
                separatorBuilder: (_, _) => const SizedBox(width: 8),
                itemBuilder: (_, i) {
                  if (i == 0) {
                    return FilterChip(
                      label: const Text('Yesterday'),
                      selected: _yesterday,
                      onSelected: (v) => setState(() => _yesterday = v),
                    );
                  }
                  if (i > store.categories.length) {
                    return ActionChip(
                      avatar: const Icon(Icons.add, size: 18),
                      label: const Text('New'),
                      onPressed: () async {
                        final created = await showCategoryEditor(context);
                        if (created != null && mounted) setState(() => _picked = created);
                      },
                    );
                  }
                  final c = store.categories[i - 1];
                  final selected = _category?.id == c.id;
                  return ChoiceChip(
                    avatar: Text(c.icon),
                    label: Text(c.name),
                    selected: selected,
                    selectedColor: hexColor(c.color).withValues(alpha: .25),
                    onSelected: (_) => setState(() => _picked = _picked?.id == c.id ? null : c),
                  );
                },
              ),
            ),
            const SizedBox(height: 8),
            _Keypad(onKey: _key),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: FilledButton.icon(
                onPressed: hasAmount && !_saving ? () => _save() : null,
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(56),
                  textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
                ),
                icon: const Icon(Icons.check_rounded),
                label: Text(hasAmount ? 'Save${_category == null ? '' : ' to ${_category!.name}'}' : 'Enter amount'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Keypad extends StatelessWidget {
  const _Keypad({required this.onKey});
  final void Function(String) onKey;

  @override
  Widget build(BuildContext context) {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: GridView.count(
        crossAxisCount: 3,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        childAspectRatio: 2.2,
        children: [
          for (final k in keys)
            InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: () => onKey(k),
              onLongPress: k == '⌫' ? () => [for (var i = 0; i < 12; i++) onKey('⌫')] : null,
              child: Center(
                child: k == '⌫'
                    ? const Icon(Icons.backspace_outlined)
                    : Text(k, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w600)),
              ),
            ),
        ],
      ),
    );
  }
}
