import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'models.dart';

/// Override with: flutter run --dart-define=API_URL=http://192.168.1.10:8000
/// The default points at the host machine from the Android emulator.
const apiUrl = String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:8000');

class ApiException implements Exception {
  ApiException(this.status, this.message);
  final int status;
  final String message;
  @override
  String toString() => message;
}

class Api {
  Api._();
  static final Api instance = Api._();

  final _client = http.Client();
  String? _access;
  String? _refresh;
  void Function()? onLoggedOut;

  bool get isLoggedIn => _refresh != null;

  Future<void> load() async {
    final p = await SharedPreferences.getInstance();
    _access = p.getString('access');
    _refresh = p.getString('refresh');
  }

  Future<void> _saveTokens(String? access, String? refresh) async {
    _access = access;
    _refresh = refresh;
    final p = await SharedPreferences.getInstance();
    if (access == null) {
      await p.remove('access');
      await p.remove('refresh');
    } else {
      await p.setString('access', access);
      await p.setString('refresh', refresh!);
    }
  }

  Future<void> logout() async {
    await _saveTokens(null, null);
    onLoggedOut?.call();
  }

  Future<bool> _refreshTokens() async {
    if (_refresh == null) return false;
    try {
      final r = await _client.post(
        Uri.parse('$apiUrl/api/auth/refresh/'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refresh': _refresh}),
      );
      if (r.statusCode != 200) return false;
      final d = jsonDecode(r.body);
      await _saveTokens(d['access'], d['refresh'] ?? _refresh);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<dynamic> request(String method, String path, {Object? body, Map<String, String>? query, bool retry = true}) async {
    final uri = Uri.parse('$apiUrl/api$path').replace(queryParameters: query);
    final req = http.Request(method, uri)
      ..headers['Content-Type'] = 'application/json'
      ..headers['Accept'] = 'application/json';
    if (_access != null) req.headers['Authorization'] = 'Bearer $_access';
    if (body != null) req.body = jsonEncode(body);
    final res = await http.Response.fromStream(await _client.send(req).timeout(const Duration(seconds: 15)));

    if (res.statusCode == 401 && retry && _refresh != null) {
      if (await _refreshTokens()) return request(method, path, body: body, query: query, retry: false);
      await logout();
    }
    final data = res.body.isEmpty ? null : jsonDecode(utf8.decode(res.bodyBytes));
    if (res.statusCode >= 400) throw ApiException(res.statusCode, _messageFrom(data) ?? 'Request failed (${res.statusCode})');
    return data;
  }

  static String? _messageFrom(dynamic d) {
    if (d is Map) {
      if (d['detail'] is String) return d['detail'];
      for (final v in d.values) {
        if (v is List && v.isNotEmpty && v.first is String) return v.first;
        if (v is String) return v;
      }
    }
    return null;
  }

  // ---- Auth ----
  Future<AppUser> login(String email, String password) async {
    final d = await request('POST', '/auth/login/', body: {'email': email, 'password': password});
    await _saveTokens(d['access'], d['refresh']);
    return AppUser.fromJson(d['user']);
  }

  Future<AppUser> register(String email, String password, String name, String currency, {bool senior = false, String? inviteCode}) async {
    final d = await request(
      'POST',
      '/auth/register/',
      body: {
        'email': email,
        'password': password,
        'first_name': name,
        'currency': currency,
        'account_type': senior ? 'senior' : 'personal',
        if (inviteCode != null && inviteCode.isNotEmpty) 'invite_code': inviteCode,
      },
    );
    await _saveTokens(d['access'], d['refresh']);
    return AppUser.fromJson(d['user']);
  }

  Future<AppUser> me() async => AppUser.fromJson(await request('GET', '/auth/me/'));

  Future<AppUser> updateMe(Map<String, dynamic> data) async => AppUser.fromJson(await request('PATCH', '/auth/me/', body: data));

  // ---- Data ----
  Future<List<Category>> categories() async => (await request('GET', '/categories/') as List).map((j) => Category.fromJson(j)).toList();

  Future<Category> saveCategory({
    int? id,
    required String name,
    required String icon,
    required String color,
    required String keywords,
  }) async {
    final body = {'name': name, 'icon': icon, 'color': color, 'keywords': keywords};
    return Category.fromJson(await request(id == null ? 'POST' : 'PATCH', id == null ? '/categories/' : '/categories/$id/', body: body));
  }

  Future<void> deleteCategory(int id) async => request('DELETE', '/categories/$id/');

  Future<Category?> suggestCategory(String note) async {
    final d = await request('GET', '/categories/suggest/', query: {'note': note});
    return d == null ? null : Category.fromJson(d);
  }

  Future<List<Frequent>> frequent() async =>
      (await request('GET', '/expenses/frequent/') as List).map((j) => Frequent.fromJson(j)).toList();

  Future<List<Expense>> expenses({bool? uncategorized, String? search, int limit = 100}) async {
    final d = await request(
      'GET',
      '/expenses/',
      query: {
        'limit': '$limit',
        if (uncategorized != null) 'uncategorized': '$uncategorized',
        if (search != null && search.isNotEmpty) 'search': search,
      },
    );
    return (d['results'] as List).map((j) => Expense.fromJson(j)).toList();
  }

  Future<Expense> createExpense(Map<String, dynamic> data) async => Expense.fromJson(await request('POST', '/expenses/', body: data));

  Future<Expense> quickAdd(String text, String clientId) async =>
      Expense.fromJson(await request('POST', '/expenses/quick/', body: {'text': text, 'client_id': clientId}));

  Future<Expense> updateExpense(int id, Map<String, dynamic> data) async =>
      Expense.fromJson(await request('PATCH', '/expenses/$id/', body: data));

  Future<void> deleteExpense(int id) async => request('DELETE', '/expenses/$id/');

  Future<void> bulkCategorize(List<int> ids, int categoryId) async =>
      request('POST', '/expenses/bulk-categorize/', body: {'ids': ids, 'category': categoryId});

  // ---- Team ----
  Future<AppUser> joinTeam(String code) async => AppUser.fromJson(await request('POST', '/team/join/', body: {'code': code}));

  Future<AppUser> leaveTeam() async => AppUser.fromJson(await request('POST', '/team/leave/'));

  Future<void> becomeSenior() async => request('POST', '/team/become-senior/');

  Future<List<TeamMember>> teamMembers() async =>
      ((await request('GET', '/team/'))['members'] as List).map((j) => TeamMember.fromJson(j)).toList();

  Future<List<Expense>> teamExpenses({int? member, int limit = 100}) async {
    final d = await request('GET', '/team/expenses/', query: {'limit': '$limit', if (member != null) 'member': '$member'});
    return (d['results'] as List).map((j) => Expense.fromJson(j)).toList();
  }

  Future<Summary> monthSummary() async {
    final now = DateTime.now();
    final start = DateTime(now.year, now.month);
    final end = DateTime(now.year, now.month + 1);
    return Summary.fromJson(
      await request('GET', '/stats/summary/', query: {'start': start.toUtc().toIso8601String(), 'end': end.toUtc().toIso8601String()}),
    );
  }
}
