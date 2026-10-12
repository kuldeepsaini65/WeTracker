import 'package:flutter/material.dart';
import 'package:quick_actions/quick_actions.dart';

import 'store.dart';
import 'ui/home_shell.dart';
import 'ui/login_screen.dart';
import 'ui/quick_add_sheet.dart';

final navigatorKey = GlobalKey<NavigatorState>();

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AppStore.instance.init();
  runApp(const WeTrackerApp());
}

class WeTrackerApp extends StatefulWidget {
  const WeTrackerApp({super.key});

  @override
  State<WeTrackerApp> createState() => _WeTrackerAppState();
}

class _WeTrackerAppState extends State<WeTrackerApp> {
  final store = AppStore.instance;

  @override
  void initState() {
    super.initState();
    // Long-press app icon → "Add expense"
    const actions = QuickActions();
    actions.initialize((type) {
      if (type != 'add_expense') return;
      final ctx = navigatorKey.currentContext;
      if (ctx != null && store.user != null) {
        showQuickAdd(ctx);
      } else {
        store.quickAddRequested = true; // cold start: HomeShell opens it once mounted
      }
    });
    actions.setShortcutItems(const [ShortcutItem(type: 'add_expense', localizedTitle: 'Add expense', icon: 'ic_launcher')]);
  }

  ThemeData _theme(Brightness b) {
    final scheme = ColorScheme.fromSeed(seedColor: const Color(0xFF7C3AED), brightness: b);
    return ThemeData(
      colorScheme: scheme,
      useMaterial3: true,
      inputDecorationTheme: InputDecorationTheme(border: OutlineInputBorder(borderRadius: BorderRadius.circular(14))),
      chipTheme: ChipThemeData(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20))),
      floatingActionButtonTheme: FloatingActionButtonThemeData(backgroundColor: scheme.primary, foregroundColor: scheme.onPrimary),
    );
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'WeTracker',
      navigatorKey: navigatorKey,
      debugShowCheckedModeBanner: false,
      theme: _theme(Brightness.light),
      darkTheme: _theme(Brightness.dark),
      home: ListenableBuilder(
        listenable: store,
        builder: (_, _) => store.user == null
            ? const LoginScreen()
            : HomeShell(key: ValueKey(store.user!.email), openQuickAdd: store.openQuickAddOnLaunch),
      ),
    );
  }
}
