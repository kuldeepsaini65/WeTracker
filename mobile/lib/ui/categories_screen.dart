import 'package:flutter/material.dart';

import '../models.dart';
import '../store.dart';
import 'common.dart';

const categoryColors = ['#7c3aed', '#2563eb', '#0891b2', '#059669', '#65a30d', '#ca8a04', '#ea580c', '#dc2626', '#db2777', '#475569'];
const categoryIcons = [
  '🍔', '☕', '🛒', '🚕', '⛽', '🛍️', '💡', '💊', '🎬', '📦', '🏠', '✈️', //
  '🎁', '📚', '🐶', '👶', '💼', '🏋️', '🍺', '💇', '🔧', '📱', '🎓', '💰',
];

class CategoriesScreen extends StatelessWidget {
  const CategoriesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final store = AppStore.instance;
    return ListenableBuilder(
      listenable: store,
      builder: (context, _) {
        final canManage = store.user?.canManageCategories ?? true;
        final scheme = Theme.of(context).colorScheme;
        return Scaffold(
          appBar: AppBar(title: const Text('Categories')),
          floatingActionButton: canManage
              ? FloatingActionButton.extended(
                  onPressed: () => showCategoryEditor(context),
                  icon: const Icon(Icons.add),
                  label: const Text('New'),
                )
              : null,
          body: RefreshIndicator(
            onRefresh: store.refresh,
            child: ListView(
              padding: const EdgeInsets.only(bottom: 100),
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                  child: Text(
                    canManage
                        ? (store.user?.isSenior == true
                              ? 'Your whole team uses these. Keywords let quick add pick the category for you.'
                              : 'Keywords let quick add pick the category for you.')
                        : 'Managed by ${store.user?.senior?.name ?? 'your senior'} — ask them to add or change one.',
                    style: TextStyle(color: scheme.outline),
                  ),
                ),
                for (final c in store.categories)
                  ListTile(
                    leading: CategoryAvatar(c),
                    title: Text(c.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text(c.keywords.isEmpty ? 'No keywords' : c.keywords, maxLines: 1, overflow: TextOverflow.ellipsis),
                    trailing: canManage ? const Icon(Icons.chevron_right) : null,
                    onTap: canManage ? () => showCategoryEditor(context, category: c) : null,
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}

/// Create (no [category]) or edit a category. Returns the saved category, or null if cancelled/deleted.
Future<Category?> showCategoryEditor(BuildContext context, {Category? category, String initialName = ''}) {
  return showModalBottomSheet<Category>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => _CategoryEditor(category: category, initialName: initialName),
  );
}

class _CategoryEditor extends StatefulWidget {
  const _CategoryEditor({this.category, this.initialName = ''});
  final Category? category;
  final String initialName;

  @override
  State<_CategoryEditor> createState() => _CategoryEditorState();
}

class _CategoryEditorState extends State<_CategoryEditor> {
  final store = AppStore.instance;
  late final _name = TextEditingController(text: widget.category?.name ?? widget.initialName);
  late final _keywords = TextEditingController(text: widget.category?.keywords ?? '');
  late String _icon = widget.category?.icon ?? '🏷️';
  late String _color = widget.category?.color ?? categoryColors.first;
  bool _busy = false;
  bool _confirmDelete = false;

  @override
  void dispose() {
    _name.dispose();
    _keywords.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    if (name.isEmpty) return showSnack(context, 'Give it a name');
    setState(() => _busy = true);
    final nav = Navigator.of(context);
    try {
      // Normalise "a, b ,c" → "a,b,c"
      final keywords = _keywords.text.split(',').map((k) => k.trim().toLowerCase()).where((k) => k.isNotEmpty).join(',');
      final saved = await store.api.saveCategory(id: widget.category?.id, name: name, icon: _icon, color: _color, keywords: keywords);
      await store.refresh();
      nav.pop(saved);
    } catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        showSnack(context, e.toString());
      }
    }
  }

  Future<void> _delete() async {
    setState(() => _busy = true);
    final nav = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await store.api.deleteCategory(widget.category!.id);
      await store.refresh();
      nav.pop();
      messenger.showSnackBar(
        SnackBar(
          content: Text('${widget.category!.name} deleted — its expenses are now in the Inbox'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        showSnack(context, e.toString());
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final preview = Category(id: 0, name: _name.text, icon: _icon, color: _color);
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(widget.category == null ? 'New category' : 'Edit category', style: theme.textTheme.titleLarge),
            const SizedBox(height: 16),
            Row(
              children: [
                CategoryAvatar(preview, size: 52),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _name,
                    autofocus: widget.category == null && widget.initialName.isEmpty,
                    maxLength: 50,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: const InputDecoration(labelText: 'Name', counterText: ''),
                    onChanged: (_) => setState(() {}),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text('Icon', style: theme.textTheme.labelMedium),
            const SizedBox(height: 6),
            Wrap(
              spacing: 4,
              runSpacing: 4,
              children: [
                for (final i in categoryIcons)
                  InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: () => setState(() => _icon = i),
                    child: Container(
                      width: 44,
                      height: 44,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        color: _icon == i ? theme.colorScheme.primaryContainer : null,
                        border: _icon == i ? Border.all(color: theme.colorScheme.primary, width: 2) : null,
                      ),
                      child: Text(i, style: const TextStyle(fontSize: 22)),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            Text('Colour', style: theme.textTheme.labelMedium),
            const SizedBox(height: 6),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                for (final c in categoryColors)
                  GestureDetector(
                    onTap: () => setState(() => _color = c),
                    child: Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(
                        color: hexColor(c),
                        shape: BoxShape.circle,
                        border: _color == c ? Border.all(color: theme.colorScheme.onSurface, width: 3) : null,
                      ),
                      child: _color == c ? const Icon(Icons.check, color: Colors.white, size: 18) : null,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _keywords,
              decoration: const InputDecoration(
                labelText: 'Keywords',
                hintText: 'e.g. rent, maintenance',
                helperText: 'Comma separated. Typing one of these in a note picks this category.',
                helperMaxLines: 2,
              ),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                if (widget.category != null)
                  _confirmDelete
                      ? FilledButton(
                          style: FilledButton.styleFrom(backgroundColor: theme.colorScheme.error),
                          onPressed: _busy ? null : _delete,
                          child: const Text('Confirm delete'),
                        )
                      : TextButton.icon(
                          onPressed: _busy ? null : () => setState(() => _confirmDelete = true),
                          icon: const Icon(Icons.delete_outline),
                          label: const Text('Delete'),
                          style: TextButton.styleFrom(foregroundColor: theme.colorScheme.error),
                        ),
                const Spacer(),
                FilledButton(onPressed: _busy ? null : _save, child: const Text('Save')),
              ],
            ),
            if (_confirmDelete)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text('Its expenses become uncategorized.', style: TextStyle(color: theme.colorScheme.outline, fontSize: 12)),
              ),
          ],
        ),
      ),
    );
  }
}
