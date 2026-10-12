import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models.dart';
import '../store.dart';
import 'common.dart';

/// Seniors: everyone on the team with this month's totals, plus the invite code.
class TeamTab extends StatefulWidget {
  const TeamTab({super.key});

  @override
  State<TeamTab> createState() => _TeamTabState();
}

class _TeamTabState extends State<TeamTab> {
  final store = AppStore.instance;
  List<TeamMember>? _members;
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
      final m = await store.api.teamMembers();
      if (mounted) {
        setState(() {
          _members = m;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final members = _members;
    final total = members?.fold<double>(0, (s, m) => s + m.monthTotal) ?? 0;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 120),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 4),
            child: Text('Team', style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Text(
              members == null ? '' : 'This month: ${money(total, store.currency)} across ${members.length} people',
              style: TextStyle(color: theme.colorScheme.outline),
            ),
          ),
          if (_error != null && members == null) Padding(padding: const EdgeInsets.all(20), child: Text(_error!)),
          if (members == null && _error == null)
            const Padding(
              padding: EdgeInsets.all(32),
              child: Center(child: CircularProgressIndicator()),
            ),
          if (members != null) ...[
            const SizedBox(height: 8),
            for (final m in members)
              ListTile(
                leading: CircleAvatar(child: Text(m.person.name.isEmpty ? '?' : m.person.name[0].toUpperCase())),
                title: Text(m.isSenior ? '${m.person.name} (you)' : m.person.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                subtitle: Text(
                  [
                    '${m.monthCount} ${m.monthCount == 1 ? 'expense' : 'expenses'}',
                    m.lastSpentAt == null ? 'no expenses yet' : 'last ${dayLabel(m.lastSpentAt!).toLowerCase()}',
                    if (m.uncategorizedCount > 0) '${m.uncategorizedCount} uncategorized',
                  ].join(' · '),
                ),
                trailing: Text(money(m.monthTotal, store.currency), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => MemberExpensesScreen(member: m.person))),
              ),
            if (members.length <= 1)
              Padding(
                padding: const EdgeInsets.all(20),
                child: Text('No users yet. Share your invite code below.', style: TextStyle(color: theme.colorScheme.outline)),
              ),
          ],
          if (store.user?.inviteCode != null) InviteCodeCard(code: store.user!.inviteCode!),
        ],
      ),
    );
  }
}

class InviteCodeCard extends StatelessWidget {
  const InviteCodeCard({super.key, required this.code});
  final String code;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: const EdgeInsets.all(16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Invite users', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text(
              'They enter this code when signing up. You\'ll see everything they spend.',
              style: TextStyle(color: theme.colorScheme.outline),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: SelectableText(
                    code,
                    style: theme.textTheme.headlineSmall?.copyWith(fontFamily: 'monospace', letterSpacing: 4, fontWeight: FontWeight.w800),
                  ),
                ),
                FilledButton.tonalIcon(
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: code));
                    showSnack(context, 'Invite code copied');
                  },
                  icon: const Icon(Icons.copy, size: 18),
                  label: const Text('Copy'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class MemberExpensesScreen extends StatefulWidget {
  const MemberExpensesScreen({super.key, required this.member});
  final Person member;

  @override
  State<MemberExpensesScreen> createState() => _MemberExpensesScreenState();
}

class _MemberExpensesScreenState extends State<MemberExpensesScreen> {
  final store = AppStore.instance;
  List<Expense>? _items;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final items = await store.api.teamExpenses(member: widget.member.id, limit: 200);
      if (mounted) setState(() => _items = items);
    } catch (e) {
      if (mounted) showSnack(context, e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = _items;
    return Scaffold(
      appBar: AppBar(title: Text(widget.member.name)),
      body: items == null
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                children: [
                  if (items.isEmpty)
                    const Padding(
                      padding: EdgeInsets.all(32),
                      child: Center(child: Text('No expenses yet')),
                    ),
                  // Read-only: seniors view but don't edit their users' expenses.
                  ...groupedExpenseTiles(context, items, store.currency),
                ],
              ),
            ),
    );
  }
}
