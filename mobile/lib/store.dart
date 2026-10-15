import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart' show ChangeNotifier;
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';
import 'models.dart';

/// An expense waiting to be sent. Stored locally so adding is instant and works offline.
class PendingExpense {
  PendingExpense({required this.clientId, required this.amount, required this.note, this.categoryId, required this.spentAt});

  final String clientId;
  final double amount;
  final String note;
  final int? categoryId;
  final DateTime spentAt;

  Map<String, dynamic> toJson() => {
    'client_id': clientId,
    'amount': amount.toStringAsFixed(2),
    'note': note,
    if (categoryId != null) 'category': categoryId,
    'spent_at': spentAt.toUtc().toIso8601String(),
  };

  factory PendingExpense.fromJson(Map<String, dynamic> j) => PendingExpense(
    clientId: j['client_id'],
    amount: double.parse(j['amount']),
    note: j['note'] ?? '',
    categoryId: j['category'],
    spentAt: DateTime.parse(j['spent_at']).toLocal(),
  );
}

String newClientId() {
  final r = Random.secure();
  return '${DateTime.now().microsecondsSinceEpoch.toRadixString(36)}-${List.generate(10, (_) => r.nextInt(36).toRadixString(36)).join()}';
}

class AppStore extends ChangeNotifier {
  AppStore._();
  static final AppStore instance = AppStore._();

  final api = Api.instance;
  AppUser? user;
  List<Category> categories = [];
  List<Frequent> frequent = [];
  List<Expense> recent = [];
  Summary? summary;
  List<PendingExpense> pending = [];
  bool openQuickAddOnLaunch = true;
  bool quickAddRequested = false;
  bool _syncing = false;

  String get currency => user?.currency ?? 'INR';

  Future<void> init() async {
    final p = await SharedPreferences.getInstance();
    openQuickAddOnLaunch = p.getBool('open_quick_add') ?? true;
    pending = (p.getStringList('pending') ?? []).map((s) => PendingExpense.fromJson(jsonDecode(s))).toList();
    await api.load();
    api.onLoggedOut = () {
      user = null;
      notifyListeners();
    };
    if (api.isLoggedIn) {
      try {
        user = await api.me();
      } on ApiException {
        user = null;
      } catch (_) {
        // Offline at startup: stay logged in with a placeholder so quick add still works.
        user = AppUser(id: 0, email: '', firstName: '', currency: p.getString('currency') ?? 'INR');
      }
    }
  }

  Future<void> setOpenQuickAddOnLaunch(bool v) async {
    openQuickAddOnLaunch = v;
    (await SharedPreferences.getInstance()).setBool('open_quick_add', v);
    notifyListeners();
  }

  Future<void> setUser(AppUser u) async {
    user = u;
    (await SharedPreferences.getInstance()).setString('currency', u.currency);
    notifyListeners();
  }

  Future<void> logout() async {
    await api.logout();
    user = null;
    categories = [];
    recent = [];
    frequent = [];
    summary = null;
    notifyListeners();
  }

  /// Why the last refresh couldn't load everything (null when all went fine). Shown on Home.
  String? loadError;

  Future<void> refresh() async {
    await syncPending();
    // Load each part on its own: one failing request must not leave the others stale.
    final errors = <String>[];
    Future<void> load<T>(Future<T> Function() fetch, void Function(T) apply) async {
      try {
        apply(await fetch());
      } catch (e) {
        errors.add(e.toString());
      }
    }

    await Future.wait([
      load(api.categories, (v) => categories = v),
      load(api.frequent, (v) => frequent = v),
      load(() => api.expenses(limit: 30), (v) => recent = v),
      load(api.monthSummary, (v) => summary = v),
    ]);
    loadError = errors.isEmpty ? null : errors.first;
    notifyListeners();
  }

  Future<void> _persistPending() async {
    (await SharedPreferences.getInstance()).setStringList('pending', pending.map((e) => jsonEncode(e.toJson())).toList());
  }

  /// Saves locally first (instant), then tries to send. Returns true if it reached the server.
  Future<bool> addExpense({required double amount, required String note, int? categoryId, DateTime? spentAt}) async {
    final e = PendingExpense(
      clientId: newClientId(),
      amount: amount,
      note: note,
      categoryId: categoryId,
      spentAt: spentAt ?? DateTime.now(),
    );
    pending.add(e);
    await _persistPending();
    notifyListeners();
    final before = pending.length;
    await syncPending();
    final sent = pending.length < before;
    if (sent) refresh();
    return sent;
  }

  /// Sends queued expenses. The server de-duplicates on client_id, so retries are safe.
  Future<void> syncPending() async {
    if (_syncing || pending.isEmpty) return;
    _syncing = true;
    try {
      for (final e in List.of(pending)) {
        try {
          await api.createExpense(e.toJson());
          pending.remove(e);
        } on ApiException catch (err) {
          // A 400 will never succeed (e.g. deleted category): drop the category and retry once, else give up.
          if (err.status == 400 && e.categoryId != null) {
            await api.createExpense({...e.toJson()}..remove('category'));
            pending.remove(e);
          } else if (err.status == 400) {
            pending.remove(e);
          } else {
            break;
          }
        } catch (_) {
          break; // offline — try later
        }
      }
      await _persistPending();
    } finally {
      _syncing = false;
      notifyListeners();
    }
  }

  List<Expense> get pendingAsExpenses => pending
      .map(
        (p) => Expense(
          id: null,
          amount: p.amount,
          note: p.note,
          category: categories.where((c) => c.id == p.categoryId).firstOrNull,
          spentAt: p.spentAt,
          pending: true,
        ),
      )
      .toList();
}
