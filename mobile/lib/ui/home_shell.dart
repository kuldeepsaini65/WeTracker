import 'dart:async';

import 'package:flutter/material.dart';

import '../models.dart';
import '../store.dart';
import 'common.dart';
import 'edit_expense_sheet.dart';
import 'login_screen.dart' show currencies;
import 'quick_add_sheet.dart';
import 'team_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key, this.openQuickAdd = false});
  final bool openQuickAdd;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> with WidgetsBindingObserver {
  final store = AppStore.instance;
  int _tab = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    store.refresh();
    if (widget.openQuickAdd || store.quickAddRequested) {
      store.quickAddRequested = false;
      WidgetsBinding.instance.addPostFrameCallback((_) => showQuickAdd(context));
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) store.refresh();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: store,
      builder: (context, _) {
        final inbox = store.summary?.uncategorizedCount ?? 0;
        final isSenior = store.user?.isSenior ?? false;
        // Seniors get a Team tab after Home.
        final tabs = <Widget>[
          const _HomeTab(),
          if (isSenior) const TeamTab(),
          const _ExpensesTab(),
          const _InboxTab(),
          const _SettingsTab(),
        ];
        final tab = _tab.clamp(0, tabs.length - 1);
        return Scaffold(
          body: SafeArea(
            bottom: false,
            child: IndexedStack(index: tab, children: tabs),
          ),
          floatingActionButton: tab == tabs.length - 1
              ? null
              : FloatingActionButton.large(
                  onPressed: () => showQuickAdd(context),
                  tooltip: 'Add expense',
                  child: const Icon(Icons.add_rounded, size: 40),
                ),
          bottomNavigationBar: NavigationBar(
            selectedIndex: tab,
            onDestinationSelected: (i) => setState(() => _tab = i),
            destinations: [
              const NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
              if (isSenior) const NavigationDestination(icon: Icon(Icons.groups_outlined), selectedIcon: Icon(Icons.groups), label: 'Team'),
              const NavigationDestination(
                icon: Icon(Icons.receipt_long_outlined),
                selectedIcon: Icon(Icons.receipt_long),
                label: 'Expenses',
              ),
              NavigationDestination(
                icon: Badge(isLabelVisible: inbox > 0, label: Text('$inbox'), child: const Icon(Icons.inbox_outlined)),
                selectedIcon: Badge(isLabelVisible: inbox > 0, label: Text('$inbox'), child: const Icon(Icons.inbox)),
                label: 'Inbox',
              ),
              const NavigationDestination(icon: Icon(Icons.settings_outlined), selectedIcon: Icon(Icons.settings), label: 'Settings'),
            ],
          ),
        );
      },
    );
  }
}

class _HomeTab extends StatelessWidget {
  const _HomeTab();

  @override
  Widget build(BuildContext context) => ListenableBuilder(listenable: AppStore.instance, builder: (context, _) => _build(context));

  Widget _build(BuildContext context) {
    final store = AppStore.instance;
    final s = store.summary;
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final total = s?.total ?? 0;
    final budget = store.user?.monthlyBudget;
    final items = [...store.pendingAsExpenses.reversed, ...store.recent];

    return RefreshIndicator(
      onRefresh: store.refresh,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 120),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
            child: Text(
              store.user?.firstName.isNotEmpty == true ? 'Hi, ${store.user!.firstName} 👋' : 'Hi 👋',
              style: TextStyle(color: scheme.outline),
            ),
          ),
          // Month card
          Container(
            margin: const EdgeInsets.all(16),
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [scheme.primary, Color.lerp(scheme.primary, Colors.pink, .35)!]),
              borderRadius: BorderRadius.circular(28),
            ),
            child: DefaultTextStyle(
              style: TextStyle(color: scheme.onPrimary),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Spent this month', style: TextStyle(color: scheme.onPrimary.withValues(alpha: .8))),
                  const SizedBox(height: 4),
                  Text(
                    money(total, store.currency),
                    style: theme.textTheme.displaySmall?.copyWith(color: scheme.onPrimary, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${s?.count ?? 0} expenses${s != null && s.previousTotal > 0 ? ' · ${((total - s.previousTotal) / s.previousTotal * 100).abs().toStringAsFixed(0)}% ${total >= s.previousTotal ? 'more' : 'less'} than last month' : ''}',
                    style: TextStyle(color: scheme.onPrimary.withValues(alpha: .8), fontSize: 13),
                  ),
                  if (budget != null && budget > 0) ...[
                    const SizedBox(height: 16),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: LinearProgressIndicator(
                        value: (total / budget).clamp(0, 1).toDouble(),
                        minHeight: 8,
                        backgroundColor: scheme.onPrimary.withValues(alpha: .2),
                        color: total > budget ? Colors.redAccent.shade100 : scheme.onPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      total > budget
                          ? '⚠ Over budget by ${money(total - budget, store.currency)}'
                          : '${money(budget - total, store.currency)} left of ${money(budget, store.currency)}',
                      style: const TextStyle(fontSize: 12),
                    ),
                  ],
                ],
              ),
            ),
          ),
          if (store.pending.isNotEmpty)
            ListTile(
              leading: const Icon(Icons.cloud_off),
              title: Text('${store.pending.length} waiting to sync'),
              trailing: TextButton(onPressed: store.refresh, child: const Text('Retry')),
            ),
          // Category breakdown — direct-labelled bars, single hue
          if (s != null && s.byCategory.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Column(
                children: [
                  for (final r in s.byCategory.take(5))
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Row(
                        children: [
                          CategoryAvatar(r.category, size: 32),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(r.category?.name ?? 'Uncategorized', style: const TextStyle(fontWeight: FontWeight.w600)),
                                    ),
                                    Text(money(r.total, store.currency), style: const TextStyle(fontWeight: FontWeight.w700)),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(4),
                                  child: LinearProgressIndicator(
                                    value: total > 0 ? r.total / total : 0,
                                    minHeight: 6,
                                    backgroundColor: scheme.surfaceContainerHighest,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
            child: Text('Recent', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
          ),
          if (items.isEmpty)
            Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                children: [
                  const Text('⚡', style: TextStyle(fontSize: 40)),
                  const SizedBox(height: 8),
                  const Text('Your first expense takes 2 seconds', style: TextStyle(fontWeight: FontWeight.w600)),
                  Text('Tap + , type the amount, save.', style: TextStyle(color: scheme.outline)),
                ],
              ),
            ),
          ...groupedExpenseTiles(context, items, store.currency, onTap: (e) => showEditExpense(context, e)),
        ],
      ),
    );
  }
}

class _ExpensesTab extends StatefulWidget {
  const _ExpensesTab();

  @override
  State<_ExpensesTab> createState() => _ExpensesTabState();
}

class _ExpensesTabState extends State<_ExpensesTab> {
  final store = AppStore.instance;
  List<Expense>? _items;
  String _search = '';
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    store.addListener(_load);
    _load();
  }

  @override
  void dispose() {
    store.removeListener(_load);
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final items = await store.api.expenses(search: _search, limit: 200);
      if (mounted) setState(() => _items = items);
    } catch (_) {
      if (mounted && _items == null) setState(() => _items = store.recent);
    }
  }

  @override
  Widget build(BuildContext context) {
    final total = _items?.fold<double>(0, (s, e) => s + e.amount) ?? 0;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 120),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: SearchBar(
              hintText: 'Search notes',
              leading: const Icon(Icons.search),
              elevation: const WidgetStatePropertyAll(0),
              onChanged: (v) {
                _search = v;
                _debounce?.cancel();
                _debounce = Timer(const Duration(milliseconds: 300), _load);
              },
            ),
          ),
          if (_items == null)
            const Padding(
              padding: EdgeInsets.all(32),
              child: Center(child: CircularProgressIndicator()),
            )
          else ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Text(
                '${_items!.length} expenses · ${money(total, store.currency)}',
                style: TextStyle(color: Theme.of(context).colorScheme.outline),
              ),
            ),
            ...groupedExpenseTiles(context, _items!, store.currency, onTap: (e) => showEditExpense(context, e)),
          ],
        ],
      ),
    );
  }
}

class _InboxTab extends StatefulWidget {
  const _InboxTab();

  @override
  State<_InboxTab> createState() => _InboxTabState();
}

class _InboxTabState extends State<_InboxTab> {
  final store = AppStore.instance;
  List<Expense> _items = [];
  final _selected = <int>{};
  bool _loading = true;

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
      final items = await store.api.expenses(uncategorized: true, limit: 200);
      if (mounted) {
        setState(() {
          _items = items;
          _selected.retainAll(items.map((e) => e.id));
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _apply(Category c) async {
    final ids = _selected.isNotEmpty ? _selected.toList() : [_items.first.id!];
    try {
      await store.api.bulkCategorize(ids, c.id);
      _selected.clear();
      if (mounted) showSnack(context, '${ids.length} moved to ${c.icon} ${c.name}');
      await store.refresh();
    } catch (e) {
      if (mounted) showSnack(context, e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_items.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          children: const [
            SizedBox(height: 120),
            Center(child: Text('🎉', style: TextStyle(fontSize: 48))),
            SizedBox(height: 8),
            Center(
              child: Text('All sorted!', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
            ),
            Center(child: Text('Every expense has a category.')),
          ],
        ),
      );
    }
    return Column(
      children: [
        Material(
          color: scheme.surfaceContainer,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 8, 4),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        _selected.isEmpty ? 'Tap a category to file the top expense' : '${_selected.length} selected',
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                    TextButton(
                      onPressed: () => setState(
                        () => _selected.length == _items.length ? _selected.clear() : _selected.addAll(_items.map((e) => e.id!)),
                      ),
                      child: Text(_selected.length == _items.length ? 'Clear' : 'Select all'),
                    ),
                  ],
                ),
              ),
              SizedBox(
                height: 52,
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                  scrollDirection: Axis.horizontal,
                  itemCount: store.categories.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 8),
                  itemBuilder: (_, i) {
                    final c = store.categories[i];
                    return ActionChip(avatar: Text(c.icon), label: Text(c.name), onPressed: () => _apply(c));
                  },
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _load,
            child: ListView(
              padding: const EdgeInsets.only(bottom: 120),
              children: [
                for (final e in _items)
                  ExpenseTile(
                    expense: e,
                    currency: store.currency,
                    selected: _selected.contains(e.id),
                    onTap: () => setState(() => _selected.contains(e.id) ? _selected.remove(e.id) : _selected.add(e.id!)),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _SettingsTab extends StatefulWidget {
  const _SettingsTab();

  @override
  State<_SettingsTab> createState() => _SettingsTabState();
}

class _SettingsTabState extends State<_SettingsTab> {
  final store = AppStore.instance;

  @override
  void initState() {
    super.initState();
    store.addListener(_changed);
  }

  @override
  void dispose() {
    store.removeListener(_changed);
    super.dispose();
  }

  void _changed() => setState(() {});

  Future<void> _update(Map<String, dynamic> data) async {
    try {
      await store.setUser(await store.api.updateMe(data));
      await store.refresh();
    } catch (e) {
      if (mounted) showSnack(context, e.toString());
    }
  }

  Future<void> _team(Future<AppUser> Function() action, String done) async {
    try {
      await store.setUser(await action());
      await store.refresh();
      if (mounted) showSnack(context, done);
    } catch (e) {
      if (mounted) showSnack(context, e.toString());
    }
  }

  Future<void> _join() async {
    final c = TextEditingController();
    final code = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Join a senior'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: c,
              autofocus: true,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(hintText: 'Invite code'),
            ),
            const SizedBox(height: 12),
            const Text(
              'Your senior will see your expenses and manage your categories. '
              'Expenses move to their categories by name; others land in your Inbox.',
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, c.text.trim().toUpperCase()), child: const Text('Join')),
        ],
      ),
    );
    if (code != null && code.isNotEmpty) _team(() => store.api.joinTeam(code), 'Joined the team');
  }

  Future<void> _leave() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Leave team?'),
        content: Text('${store.user?.senior?.name ?? 'Your senior'} will no longer see your expenses. You get your own categories back.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Leave')),
        ],
      ),
    );
    if (ok == true) _team(store.api.leaveTeam, 'You left the team');
  }

  Future<void> _editBudget() async {
    final c = TextEditingController(text: store.user?.monthlyBudget?.toStringAsFixed(0) ?? '');
    final v = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Monthly budget'),
        content: TextField(
          controller: c,
          autofocus: true,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(hintText: 'Leave empty for none'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, c.text.trim()), child: const Text('Save')),
        ],
      ),
    );
    if (v != null) _update({'monthly_budget': v.isEmpty ? null : v});
  }

  @override
  Widget build(BuildContext context) {
    final u = store.user;
    return ListView(
      children: [
        ListTile(
          title: Text(u?.firstName.isNotEmpty == true ? u!.firstName : 'Account', style: const TextStyle(fontWeight: FontWeight.w700)),
          subtitle: Text(u?.email ?? ''),
        ),
        const Divider(),
        SwitchListTile(
          title: const Text('Open quick add on launch'),
          subtitle: const Text('Start straight on the keypad'),
          value: store.openQuickAddOnLaunch,
          onChanged: store.setOpenQuickAddOnLaunch,
        ),
        ListTile(
          title: const Text('Currency'),
          trailing: DropdownButton<String>(
            value: currencies.contains(store.currency) ? store.currency : null,
            underline: const SizedBox(),
            items: [for (final c in currencies) DropdownMenuItem(value: c, child: Text(c))],
            onChanged: (v) => _update({'currency': v}),
          ),
        ),
        ListTile(
          title: const Text('Monthly budget'),
          subtitle: Text(u?.monthlyBudget == null ? 'Not set' : money(u!.monthlyBudget!, store.currency)),
          trailing: const Icon(Icons.chevron_right),
          onTap: _editBudget,
        ),
        const Divider(),
        if (u?.isSenior == true) ...[
          const ListTile(leading: Icon(Icons.groups), title: Text('You\'re a senior'), subtitle: Text('See your users in the Team tab')),
          if (u!.inviteCode != null) InviteCodeCard(code: u.inviteCode!),
        ] else if (u?.senior != null)
          ListTile(
            leading: const Icon(Icons.groups),
            title: Text('Part of ${u!.senior!.name}\'s team'),
            subtitle: Text('${u.senior!.email} can see your expenses'),
            trailing: TextButton(onPressed: _leave, child: const Text('Leave')),
          )
        else ...[
          ListTile(
            leading: const Icon(Icons.group_add),
            title: const Text('Join a senior'),
            subtitle: const Text('Enter an invite code'),
            onTap: _join,
          ),
          ListTile(
            leading: const Icon(Icons.admin_panel_settings_outlined),
            title: const Text('Become a senior'),
            subtitle: const Text('Invite users and see their spending'),
            onTap: () => _team(() async {
              await store.api.becomeSenior();
              return store.api.me();
            }, 'You\'re a senior now — share your invite code'),
          ),
        ],
        const ListTile(
          title: Text('Tip'),
          subtitle: Text('Long-press the app icon for an "Add expense" shortcut. Manage categories & keywords on the web app.'),
        ),
        const Divider(),
        ListTile(leading: const Icon(Icons.logout), title: const Text('Log out'), onTap: store.logout),
      ],
    );
  }
}
