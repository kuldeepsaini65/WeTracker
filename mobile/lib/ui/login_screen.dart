import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart' show apiUrl;

import '../store.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _name = TextEditingController();
  final _invite = TextEditingController();
  String _currency = 'INR';
  String _accountType = 'personal'; // personal | join | senior
  bool _register = false;
  bool _busy = false;
  String? _error;

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final store = AppStore.instance;
    try {
      final user = _register
          ? await store.api.register(
              _email.text.trim(),
              _password.text,
              _name.text.trim(),
              _currency,
              senior: _accountType == 'senior',
              inviteCode: _accountType == 'join' ? _invite.text.trim().toUpperCase() : null,
            )
          : await store.api.login(_email.text.trim(), _password.text);
      await store.setUser(user);
      await store.refresh();
    } catch (e) {
      setState(
        () => _error = e.toString().contains('Connection') || e.toString().contains('Socket')
            ? 'Can\'t reach the server. Check your connection.'
            : e.toString(),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: AutofillGroup(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 64,
                      height: 64,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: theme.colorScheme.primary, borderRadius: BorderRadius.circular(18)),
                      child: Icon(Icons.check_rounded, color: theme.colorScheme.onPrimary, size: 40),
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    _register ? 'Create your account' : 'Welcome back',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Log every expense in two seconds.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: theme.colorScheme.outline),
                  ),
                  const SizedBox(height: 32),
                  if (_register) ...[
                    SegmentedButton<String>(
                      segments: const [
                        ButtonSegment(value: 'personal', label: Text('Just me')),
                        ButtonSegment(value: 'join', label: Text('Join senior')),
                        ButtonSegment(value: 'senior', label: Text('I\'m senior')),
                      ],
                      selected: {_accountType},
                      showSelectedIcon: false,
                      onSelectionChanged: (v) => setState(() => _accountType = v.first),
                    ),
                    const SizedBox(height: 12),
                    if (_accountType == 'join') ...[
                      TextField(
                        controller: _invite,
                        textCapitalization: TextCapitalization.characters,
                        decoration: const InputDecoration(labelText: 'Invite code', helperText: 'Your senior will see your expenses'),
                      ),
                      const SizedBox(height: 12),
                    ],
                    TextField(
                      controller: _name,
                      decoration: const InputDecoration(labelText: 'Name'),
                      autofillHints: const [AutofillHints.givenName],
                    ),
                    const SizedBox(height: 12),
                  ],
                  TextField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    autofillHints: const [AutofillHints.email],
                    decoration: const InputDecoration(labelText: 'Email'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _password,
                    obscureText: true,
                    autofillHints: [_register ? AutofillHints.newPassword : AutofillHints.password],
                    decoration: const InputDecoration(labelText: 'Password', helperText: 'At least 8 characters'),
                    onSubmitted: (_) => _submit(),
                  ),
                  if (_register) ...[
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: _currency,
                      decoration: const InputDecoration(labelText: 'Currency'),
                      items: [for (final c in currencies) DropdownMenuItem(value: c, child: Text(c))],
                      onChanged: (v) => setState(() => _currency = v!),
                    ),
                  ],
                  if (_error != null) ...[const SizedBox(height: 16), Text(_error!, style: TextStyle(color: theme.colorScheme.error))],
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: _busy ? null : _submit,
                    style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(54)),
                    child: _busy
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                        : Text(_register ? 'Create account' : 'Log in'),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: () => setState(() => _register = !_register),
                    child: Text(_register ? 'Already have an account? Log in' : 'New here? Create an account'),
                  ),
                  TextButton(
                    onPressed: () => launchUrl(Uri.parse('$apiUrl/privacy'), mode: LaunchMode.externalApplication),
                    child: Text('Privacy policy', style: TextStyle(color: theme.colorScheme.outline, fontSize: 12)),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

const currencies = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY'];
